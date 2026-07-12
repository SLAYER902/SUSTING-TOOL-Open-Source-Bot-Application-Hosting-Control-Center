import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireUser(); const project = await prisma.project.findUnique({ where: { id: (await params).id }, include: { deployments: { orderBy: { createdAt: "desc" }, take: 20 }, variables: { select: { id: true, key: true, isSecret: true, environment: true, updatedAt: true } } } }); return project ? NextResponse.json({ project }) : NextResponse.json({ error: "Project not found." }, { status: 404 }); }
  catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const user = await requireUser(); if (!["OWNER", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Only owners and admins can delete a project." }, { status: 403 }); const { id } = await params; await prisma.project.delete({ where: { id } }); await audit(user.id, "PROJECT_DELETED", "Project", id); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Unable to delete the project." }, { status: 400 }); }
}

const patchSchema = z.object({ description: z.string().max(500).nullable().optional(), memoryMb: z.number().int().min(128).max(32768).optional(), cpuLimit: z.number().min(.1).max(16).optional(), restartPolicy: z.enum(["no", "on-failure", "unless-stopped", "always"]).optional() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const user = await requireUser(); if (user.role === "VIEWER") return NextResponse.json({ error: "Read-only role." }, { status: 403 }); const input = patchSchema.parse(await request.json()); const { id } = await params; const project = await prisma.project.update({ where: { id }, data: input }); await audit(user.id, "PROJECT_UPDATED", "Project", id); return NextResponse.json({ project }); }
  catch { return NextResponse.json({ error: "Unable to update the project." }, { status: 400 }); }
}
