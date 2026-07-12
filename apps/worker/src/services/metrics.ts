import { PrismaClient } from "@prisma/client";
import { docker } from "../providers/local-docker.js";

const prisma = new PrismaClient();

type DockerStats = { cpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number; online_cpus?: number }; precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number }; memory_stats?: { usage?: number }; networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }> };

export async function sampleRunningProjects() {
  const projects = await prisma.project.findMany({ where: { status: "RUNNING", containerId: { not: null } }, select: { id: true, containerId: true } });
  await Promise.all(projects.map(async (project) => {
    try {
      const stats = await docker.getContainer(project.containerId!).stats({ stream: false }) as unknown as DockerStats;
      const total = stats.cpu_stats?.cpu_usage?.total_usage || 0; const previous = stats.precpu_stats?.cpu_usage?.total_usage || 0; const system = stats.cpu_stats?.system_cpu_usage || 0; const previousSystem = stats.precpu_stats?.system_cpu_usage || 0; const cpus = stats.cpu_stats?.online_cpus || 1;
      const cpuPercent = system > previousSystem ? ((total - previous) / (system - previousSystem)) * cpus * 100 : 0;
      const network = Object.values(stats.networks || {}).reduce((sum, item) => ({ rx: sum.rx + BigInt(item.rx_bytes || 0), tx: sum.tx + BigInt(item.tx_bytes || 0) }), { rx: 0n, tx: 0n });
      await prisma.metric.create({ data: { projectId: project.id, cpuPercent: Number.isFinite(cpuPercent) ? cpuPercent : 0, memoryBytes: BigInt(stats.memory_stats?.usage || 0), networkRx: network.rx, networkTx: network.tx, diskBytes: 0n } });
    } catch { /* A stopping container is expected to be unavailable briefly. */ }
  }));
}
