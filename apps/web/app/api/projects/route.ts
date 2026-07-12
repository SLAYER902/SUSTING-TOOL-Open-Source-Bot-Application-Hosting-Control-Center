import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security";
import { runtimePresets } from "@/lib/runtime";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional(),
  type: z.enum(["DISCORD_BOT", "TELEGRAM_BOT", "WHATSAPP_INTEGRATION", "WEB_SERVICE", "BACKGROUND_WORKER", "STATIC_WEBSITE", "API", "SCHEDULED_JOB"]),
  sourceType: z.enum(["GITHUB", "GIT", "ZIP", "EMPTY", "TEMPLATE"]), runtimeKey: z.enum(["node", "python", "java", "go", "rust", "php", "docker", "static"]),
  repositoryUrl: z.string().url().optional().or(z.literal("")), branch: z.string().trim().max(120).optional(), rootDirectory: z.string().trim().max(300).optional(),
  installCommand: z.string().trim().max(500).optional(), buildCommand: z.string().trim().max(500).optional(), startCommand: z.string().trim().max(500).optional(),
  internalPort: z.coerce.number().int().min(1).max(65535).optional(), healthcheckPath: z.string().trim().max(250).optional(),
  memoryMb: z.coerce.number().int().min(128).max(32768).default(512), cpuLimit: z.coerce.number().min(0.1).max(16).default(0.5), restartPolicy: z.enum(["no", "on-failure", "unless-stopped", "always"]).default("unless-stopped")
});

function safeProject(project: Awaited<ReturnType<typeof prisma.project.findMany>>[number]) {
  return project;
}

export async function GET() {
  try {
    await requireUser();
    const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: { deployments: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { variables: true } } } });
    return NextResponse.json({ projects: projects.map(safeProject) });
  } catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role === "VIEWER") return NextResponse.json({ error: "Your role cannot create projects." }, { status: 403 });
    const input = schema.parse(await request.json());
    if (["GITHUB", "GIT"].includes(input.sourceType) && !input.repositoryUrl) return NextResponse.json({ error: "A repository URL is required for this source." }, { status: 400 });
    const preset = runtimePresets[input.runtimeKey];
    const base = slugify(input.name) || "project";
    const existing = await prisma.project.findFirst({ where: { slug: base } });
    const slug = existing ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;
    const project = await prisma.project.create({ data: {
      name: input.name, slug, description: input.description || null, type: input.type, sourceType: input.sourceType, runtime: preset.runtime,
      runtimeVersion: preset.runtime.split(" ").at(-1), repositoryUrl: input.repositoryUrl || null, branch: input.branch || "main", rootDirectory: input.rootDirectory || ".",
      installCommand: input.installCommand || preset.installCommand || null, buildCommand: input.buildCommand || preset.buildCommand || null, startCommand: input.startCommand || preset.startCommand,
      internalPort: input.internalPort ?? preset.port ?? null, healthcheckPath: input.healthcheckPath || null, memoryMb: input.memoryMb, cpuLimit: input.cpuLimit, restartPolicy: input.restartPolicy
    } });
    await audit(user.id, "PROJECT_CREATED", "Project", project.id, { sourceType: input.sourceType, runtime: project.runtime });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid project configuration." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to create the project." }, { status: 500 });
  }
}
