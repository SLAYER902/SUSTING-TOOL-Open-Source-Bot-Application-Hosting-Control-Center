import { NextResponse } from "next/server";
import { audit, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";

async function requestRunner(path: string, body: unknown) {
  const url = process.env.RUNNER_URL;
  const token = process.env.RUNNER_SHARED_SECRET;
  if (!url || !token) throw new Error("Runner connection is not configured.");
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-runner-token": token }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("The runner rejected the deployment request.");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser();
    if (user.role === "VIEWER") return NextResponse.json({ error: "Read-only role." }, { status: 403 });
    const { id } = await params; const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const deployment = await prisma.deployment.create({ data: { projectId: id, triggeredBy: user.id, status: "QUEUED", logs: "[system] Deployment queued by control plane\n" } });
    await prisma.project.update({ where: { id }, data: { status: "QUEUED" } });
    try { await requestRunner("/deployments", { deploymentId: deployment.id }); }
    catch (error) { await prisma.deployment.update({ where: { id: deployment.id }, data: { status: "START_FAILED", completedAt: new Date(), failureReason: error instanceof Error ? error.message : "Runner unavailable", logs: "[error] Runner was not reachable. Configure RUNNER_URL and RUNNER_SHARED_SECRET.\n" } }); await prisma.project.update({ where: { id }, data: { status: "FAILED" } }); return NextResponse.json({ error: "Deployment could not start: the isolated runner is unavailable." }, { status: 503 }); }
    await audit(user.id, "DEPLOYMENT_QUEUED", "Deployment", deployment.id, { projectId: id });
    return NextResponse.json({ deployment }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication is required." : "Unable to queue deployment." }, { status: 400 }); }
}
