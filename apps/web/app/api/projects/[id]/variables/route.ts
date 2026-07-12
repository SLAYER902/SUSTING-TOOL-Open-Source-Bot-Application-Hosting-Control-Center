import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, encryptSecret } from "@/lib/security";

const schema = z.object({ key: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use a conventional environment variable key.").max(128), value: z.string().max(32_768), isSecret: z.boolean().default(true), environment: z.enum(["production", "preview", "development"]).default("production") });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const variables = await prisma.environmentVariable.findMany({ where: { projectId: (await params).id }, select: { id: true, key: true, isSecret: true, environment: true, createdAt: true, updatedAt: true }, orderBy: { key: "asc" } });
    return NextResponse.json({ variables });
  } catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role === "VIEWER") return NextResponse.json({ error: "Read-only role." }, { status: 403 });
    const input = schema.parse(await request.json()); const { id } = await params;
    const variable = await prisma.environmentVariable.upsert({ where: { projectId_environment_key: { projectId: id, environment: input.environment, key: input.key } }, create: { projectId: id, key: input.key, encryptedValue: encryptSecret(input.value), isSecret: input.isSecret, environment: input.environment }, update: { encryptedValue: encryptSecret(input.value), isSecret: input.isSecret } });
    await audit(user.id, "VARIABLE_SAVED", "EnvironmentVariable", variable.id, { projectId: id, key: input.key, isSecret: input.isSecret });
    return NextResponse.json({ variable: { id: variable.id, key: variable.key, isSecret: variable.isSecret, environment: variable.environment } });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "Unable to save the variable." }, { status: 400 }); }
}
