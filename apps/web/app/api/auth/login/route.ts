import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { audit, createSession, ensureInitialAdmin, rateLimit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(512), remember: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!rateLimit(request)) return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
    const input = schema.parse(await request.json());
    await ensureInitialAdmin();
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    const valid = Boolean(user && await argon2.verify(user.passwordHash, input.password));
    if (!valid || !user) {
      await audit(null, "AUTH_LOGIN_FAILED", "User", undefined, { usernameHash: Buffer.from(input.username).toString("base64") });
      return NextResponse.json({ error: "Incorrect credentials or unavailable account." }, { status: 401 });
    }
    await createSession(user.id, input.remember);
    await audit(user.id, "AUTH_LOGIN_SUCCEEDED", "User", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400 });
    return NextResponse.json({ error: message.includes("ADMIN_") || message.includes("too weak") || message.includes("SESSION_SECRET") ? "Server authentication has not been configured safely." : "Unable to sign in right now." }, { status: 503 });
  }
}
