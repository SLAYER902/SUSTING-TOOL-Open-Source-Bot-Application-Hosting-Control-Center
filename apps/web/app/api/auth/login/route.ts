import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { audit, createSession, ensureInitialAdmin, rateLimit } from "@/lib/auth";
import { assertAuthenticationEnvironment } from "@/lib/env.mjs";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(512), remember: z.boolean().optional() });

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "[redacted database URL]");
}

function logLoginError(context: string, error: unknown): void {
  console.error(`[auth/login] ${context}`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: safeErrorMessage(error),
  });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!rateLimit(request)) return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
    const input = schema.parse(await request.json());
    assertAuthenticationEnvironment();
    await ensureInitialAdmin();
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    const valid = Boolean(user && await argon2.verify(user.passwordHash, input.password));
    if (!valid || !user) {
      try {
        await audit(null, "AUTH_LOGIN_FAILED", "User", undefined, { usernameHash: Buffer.from(input.username).toString("base64") });
      } catch (auditError) {
        logLoginError("Audit log write failed", auditError);
      }
      return NextResponse.json({ error: "Incorrect credentials or unavailable account." }, { status: 401 });
    }
    await createSession(user.id, input.remember);
    try {
      await audit(user.id, "AUTH_LOGIN_SUCCEEDED", "User", user.id);
    } catch (auditError) {
      logLoginError("Audit log write failed", auditError);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400 });
    logLoginError("Internal login failure", error);
    if (error instanceof Error && error.message === "Cross-site request rejected.") {
      return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
    }
    return NextResponse.json({ error: "Authentication service temporarily unavailable." }, { status: 503 });
  }
}
