import { timingSafeEqual } from "node:crypto";
import express from "express";
import { z } from "zod";
import { deploy, projectAction } from "./services/deploy.js";
import { sampleRunningProjects } from "./services/metrics.js";

const app = express(); app.use(express.json({ limit: "64kb" }));
function authorized(request: express.Request, response: express.Response, next: express.NextFunction) { const expected = process.env.RUNNER_SHARED_SECRET; const provided = request.header("x-runner-token"); if (!expected || !provided || expected.length !== provided.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return response.status(401).json({ error: "Unauthorized runner request." }); next(); }
app.get("/health", (_request, response) => response.json({ status: "ready" }));
app.post("/deployments", authorized, async (request, response) => { const parsed = z.object({ deploymentId: z.string().cuid() }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid deployment request." }); void deploy(parsed.data.deploymentId); return response.status(202).json({ accepted: true }); });
app.post("/projects/:id/actions", authorized, async (request, response) => { const parsed = z.object({ action: z.enum(["start", "stop", "restart"]) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid action." }); const projectId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id; if (!projectId) return response.status(400).json({ error: "Invalid project ID." }); try { await projectAction(projectId, parsed.data.action); return response.json({ ok: true }); } catch (error) { return response.status(409).json({ error: error instanceof Error ? error.message : "Runner action failed." }); } });
app.listen(Number(process.env.WORKER_PORT || 4000), "0.0.0.0", () => console.info("SULAYER runner ready"));
void sampleRunningProjects();
setInterval(() => void sampleRunningProjects(), 30_000).unref();
