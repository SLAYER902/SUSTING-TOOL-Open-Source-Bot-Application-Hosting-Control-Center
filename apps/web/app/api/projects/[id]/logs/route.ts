import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const deployment = await prisma.deployment.findFirst({ where: { projectId: (await params).id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, logs: true, failureReason: true, createdAt: true } });
    if (!deployment) return NextResponse.json({ logs: "[system] No deployment logs have been received yet.\n", deployment: null });
    return NextResponse.json({ logs: deployment.logs, deployment: { ...deployment, failureReason: deployment.failureReason || null } });
  } catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}
