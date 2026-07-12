import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const { id } = await params; const encoder = new TextEncoder(); let previous = ""; let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      async start(controller) {
        const publish = async () => { const deployment = await prisma.deployment.findFirst({ where: { projectId: id }, orderBy: { createdAt: "desc" }, select: { logs: true, status: true } }); const current = deployment?.logs || ""; if (current !== previous) { previous = current; controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify({ logs: current, status: deployment?.status || "NONE" })}\n\n`)); } };
        await publish(); timer = setInterval(() => void publish().catch(() => undefined), 1_500);
      },
      cancel() { if (timer) clearInterval(timer); }
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch { return new Response("Unauthorized", { status: 401 }); }
}
