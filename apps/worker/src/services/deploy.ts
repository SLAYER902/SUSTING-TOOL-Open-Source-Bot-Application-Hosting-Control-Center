import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient, DeploymentStatus, ProjectStatus } from "@prisma/client";
import { docker, ensureInternalNetwork } from "../providers/local-docker.js";
import { decryptSecret } from "./crypto.js";
import { prepareWorkspace } from "./workspace.js";

const prisma = new PrismaClient();
const maxLogLength = 160_000;

async function append(deploymentId: string, line: string) {
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { logs: true } });
  const logs = `${deployment?.logs || ""}${line.replace(/\r?\n?$/, "\n")}`.slice(-maxLogLength);
  await prisma.deployment.update({ where: { id: deploymentId }, data: { logs } });
}
async function transition(deploymentId: string, projectId: string, status: DeploymentStatus, log: string, projectStatus: ProjectStatus = "DEPLOYING") {
  await prisma.deployment.update({ where: { id: deploymentId }, data: { status, startedAt: status === "CLONING" ? new Date() : undefined } });
  await prisma.project.update({ where: { id: projectId }, data: { status: projectStatus } }); await append(deploymentId, `[${status}] ${log}`);
}

function generatedDockerfile(project: { runtime: string; installCommand: string | null; buildCommand: string | null; startCommand: string }) {
  const isPython = project.runtime.toLowerCase().startsWith("python");
  const base = isPython ? "python:3.12-slim" : "node:22-alpine";
  const install = project.installCommand || (isPython ? "pip install --no-cache-dir -r requirements.txt" : "npm ci --omit=dev");
  const build = project.buildCommand ? `RUN ${project.buildCommand}` : "";
  return `FROM ${base}\nWORKDIR /app\nCOPY . .\nRUN addgroup -S app && adduser -S app -G app\nRUN ${install}\n${build}\nUSER app\nCMD ["/bin/sh", "-lc", ${JSON.stringify(project.startCommand)}]\n`;
}

async function ensureDockerfile(directory: string, project: { runtime: string; installCommand: string | null; buildCommand: string | null; startCommand: string }) {
  try { await readFile(join(directory, "Dockerfile")); } catch { await writeFile(join(directory, "Dockerfile"), generatedDockerfile(project), { mode: 0o640 }); }
}

async function buildImage(directory: string, tag: string, deploymentId: string) {
  const stream = await docker.buildImage({ context: directory, src: ["."] }, { t: tag, rm: true, forcerm: true });
  await new Promise<void>((resolve, reject) => docker.modem.followProgress(stream, (error: Error | null) => error ? reject(error) : resolve(), (event: { stream?: string }) => { if (event.stream) void append(deploymentId, event.stream); }));
}

export async function deploy(deploymentId: string) {
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId }, include: { project: { include: { variables: true } } } });
  if (!deployment) throw new Error("Deployment record was not found.");
  const { project } = deployment;
  try {
    await transition(deploymentId, project.id, "CLONING", "Preparing a restricted project workspace.");
    const directory = await prepareWorkspace(project);
    await transition(deploymentId, project.id, "ANALYZING", `Detected configured runtime: ${project.runtime}.`);
    await transition(deploymentId, project.id, "INSTALLING", "Generating container build plan.");
    await ensureDockerfile(directory, project);
    const tag = `sulayer/${project.slug}:${deploymentId.slice(-10).toLowerCase()}`;
    await transition(deploymentId, project.id, "BUILDING", "Building isolated image; build output is retained without environment values.");
    await buildImage(directory, tag, deploymentId);
    await transition(deploymentId, project.id, "CREATING_CONTAINER", "Applying CPU, memory, network, and capability restrictions.");
    if (project.containerId) await docker.getContainer(project.containerId).remove({ force: true }).catch(() => undefined);
    const network = await ensureInternalNetwork();
    const environment = project.variables.map((variable) => `${variable.key}=${decryptSecret(variable.encryptedValue)}`);
    const exposed = project.internalPort ? { [`${project.internalPort}/tcp`]: {} } : undefined;
    const container = await docker.createContainer({
      Image: tag, name: `sulayer-${project.slug}-${deploymentId.slice(-6).toLowerCase()}`, Env: environment, ExposedPorts: exposed,
      User: "1000:1000", WorkingDir: "/app", Labels: { "io.sulayer.project": project.id, "io.sulayer.deployment": deploymentId, "io.sulayer.managed": "true" },
      HostConfig: { Memory: project.memoryMb * 1024 * 1024, NanoCpus: Math.round(project.cpuLimit * 1_000_000_000), ReadonlyRootfs: true, Tmpfs: { "/tmp": "rw,noexec,nosuid,size=64m" }, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges:true"], NetworkMode: network, RestartPolicy: { Name: project.restartPolicy === "no" ? "no" : project.restartPolicy as "always" | "unless-stopped" | "on-failure" }, PidsLimit: 256, Privileged: false }
    });
    await transition(deploymentId, project.id, "STARTING", "Starting unprivileged project container."); await container.start();
    await transition(deploymentId, project.id, "HEALTH_CHECKING", "Checking that the process remains running."); await new Promise((resolve) => setTimeout(resolve, 1_500));
    const inspection = await container.inspect(); if (!inspection.State.Running) throw new Error(`Container exited with code ${inspection.State.ExitCode ?? "unknown"}.`);
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "RUNNING", completedAt: new Date(), imageTag: tag } });
    await prisma.project.update({ where: { id: project.id }, data: { status: "RUNNING", containerId: container.id } }); await append(deploymentId, "[RUNNING] Container is healthy and isolated.\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deployment failure.";
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "BUILD_FAILED", completedAt: new Date(), failureReason: message } }).catch(() => undefined);
    await prisma.project.update({ where: { id: project.id }, data: { status: "FAILED" } }).catch(() => undefined); await append(deploymentId, `[ERROR] ${message}`);
  }
}

export async function projectAction(projectId: string, action: "start" | "stop" | "restart") {
  const project = await prisma.project.findUnique({ where: { id: projectId } }); if (!project?.containerId) throw new Error("No active container is available for this project.");
  const container = docker.getContainer(project.containerId);
  if (action === "start") await container.start(); else if (action === "stop") await container.stop({ t: 15 }); else await container.restart({ t: 15 });
  await prisma.project.update({ where: { id: projectId }, data: { status: action === "stop" ? "STOPPED" : "RUNNING" } });
}
