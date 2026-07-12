import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const samples = await prisma.metric.findMany({ where: { projectId: (await params).id }, orderBy: { recordedAt: "desc" }, take: 180 });
    return NextResponse.json({ samples: samples.map((sample) => ({ ...sample, memoryBytes: sample.memoryBytes.toString(), networkRx: sample.networkRx.toString(), networkTx: sample.networkTx.toString(), diskBytes: sample.diskBytes.toString() })) });
  } catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}
