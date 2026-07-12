import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { assertAuthenticationEnvironment } from "@/lib/env.mjs";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/security";

const cookieName = "sulayer_session";
const encoder = new TextEncoder();
const attempts = new Map<string, { count: number; resetAt: number }>();

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return encoder.encode(secret);
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function ensureInitialAdmin() {
  const environment = assertAuthenticationEnvironment();
  const username = environment.ADMIN_USERNAME.trim();
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) return;
  const weakness = validatePassword(environment.ADMIN_PASSWORD);
  if (weakness) throw new Error("Invalid environment variables: ADMIN_PASSWORD");

  try {
    await prisma.user.create({
      data: {
        username,
        email: process.env.ADMIN_EMAIL || null,
        passwordHash: await argon2.hash(environment.ADMIN_PASSWORD, { type: argon2.argon2id }),
        role: "OWNER",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

export function rateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = hash(ip);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now > current.resetAt) { attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; }
  current.count += 1;
  return current.count <= 10;
}

export async function createSession(userId: string, remember = false) {
  const requestHeaders = await headers();
  const life = remember ? 30 * 24 * 60 * 60_000 : 8 * 60 * 60_000;
  const session = await prisma.session.create({
    data: {
      id: randomUUID(), userId, expiresAt: new Date(Date.now() + life),
      ipHash: hash(requestHeaders.get("x-forwarded-for")?.split(",")[0] || "local"),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 512)
    }
  });
  const token = await new SignJWT({ sid: session.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(session.expiresAt.getTime() / 1000)).sign(sessionKey());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: session.expiresAt });
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    const sid = typeof payload.sid === "string" ? payload.sid : "";
    if (!sid) return null;
    const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
  } catch { return null; }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, sessionKey());
      if (typeof payload.sid === "string") await prisma.session.delete({ where: { id: payload.sid } }).catch(() => undefined);
    } catch { /* Invalid cookies are simply removed. */ }
  }
  jar.delete(cookieName);
}

export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Prisma.InputJsonObject,
) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId,
    action,
    entityType,
    ...(entityId !== undefined ? { entityId } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  await prisma.auditLog.create({ data });
}
