import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ action: z.enum(["start", "stop", "restart", "rebuild"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const { action } = schema.parse(await request.json()); const { id } = await params;
    if (user.role === "VIEWER" || (user.role === "OPERATOR" && action === "rebuild")) return NextResponse.json({ error: "Your role cannot perform this action." }, { status: 403 });
    if (action === "rebuild") return NextResponse.redirect(new URL(`/api/projects/${id}/deploy`, request.url), 307);
    const runner = process.env.RUNNER_URL; const token = process.env.RUNNER_SHARED_SECRET;
    if (!runner || !token) return NextResponse.json({ error: "Runner connection is not configured." }, { status: 503 });
    const response = await fetch(`${runner.replace(/\/$/, "")}/projects/${id}/actions`, { method: "POST", headers: { "content-type": "application/json", "x-runner-token": token }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return NextResponse.json({ error: "Runner could not complete this request." }, { status: 502 });
    await audit(user.id, `PROJECT_${action.toUpperCase()}`, "Project", id);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Choose a supported project action." : "Unable to control the project." }, { status: 400 }); }
}
