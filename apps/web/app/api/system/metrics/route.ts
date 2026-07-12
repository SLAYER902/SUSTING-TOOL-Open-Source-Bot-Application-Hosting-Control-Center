import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireUser(); const samples = await prisma.metric.findMany({ orderBy: { recordedAt: "desc" }, take: 500 }); const recent = new Map<string, typeof samples[number]>(); for (const sample of samples) if (!recent.has(sample.projectId)) recent.set(sample.projectId, sample);
    const values = [...recent.values()]; const cpuPercent = values.reduce((sum, sample) => sum + sample.cpuPercent, 0); const memoryBytes = values.reduce((sum, sample) => sum + sample.memoryBytes, 0n); const networkRx = values.reduce((sum, sample) => sum + sample.networkRx, 0n); const networkTx = values.reduce((sum, sample) => sum + sample.networkTx, 0n);
    return NextResponse.json({ cpuPercent, memoryBytes: memoryBytes.toString(), networkRx: networkRx.toString(), networkTx: networkTx.toString(), samples: values.length });
  } catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}
