import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { assertAuthenticationEnvironment } from "../lib/env.mjs";

const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);
const migrationName = "20260712103000_init";
const schemaPath = "../../packages/database/prisma/schema.prisma";
const expectedTables = ["User", "Session", "Project", "Deployment", "EnvironmentVariable", "Metric", "Domain", "AuditLog", "Node"];

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT must be an integer from 1 to 65535; received "${rawPort}".`);
}

function run(command, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, { env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || `code ${code ?? "unknown"}`}.`));
    });
  });
}

function isConfigurationError(error) {
  return error instanceof Error && /^(Missing required|Invalid) environment variables:/.test(error.message);
}

function safeStartupMessage(error, fallback) {
  if (isConfigurationError(error)) return error.message;
  if (error instanceof Error && /^npx(?:\.cmd)? exited with /.test(error.message)) return error.message;
  return fallback;
}

async function prepareMigrationHistory(npx) {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const tables = new Set(rows.map((row) => row.table_name));
    const hasMigrationHistory = tables.has("_prisma_migrations");
    const hasLegacySchema = expectedTables.every((table) => tables.has(table));

    if (hasLegacySchema && !hasMigrationHistory) {
      console.info("[startup] Existing database detected; baselining initial migration");
      await run(npx, ["prisma", "migrate", "resolve", "--applied", migrationName, "--schema", schemaPath]);
      console.info("[startup] Initial migration baseline completed");
    }
  } catch (error) {
    console.error("[startup] Database preparation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: "Database connectivity or migration history check failed.",
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function runStartupStep(label, command, argumentsList) {
  try {
    await run(command, argumentsList);
  } catch (error) {
    console.error(`[startup] ${label} failed`, {
      name: error instanceof Error ? error.name : "UnknownError",
      message: safeStartupMessage(error, `${label} did not complete.`),
    });
    throw error;
  }
}

async function start() {
  console.info("[startup] Beginning production startup");
  console.info("[startup] Validating environment");
  assertAuthenticationEnvironment();
  console.info("[startup] Environment validation passed");

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  await prepareMigrationHistory(npx);

  console.info("[startup] Applying Prisma migrations");
  await runStartupStep("Prisma migration", npx, ["prisma", "migrate", "deploy", "--schema", schemaPath]);
  console.info("[startup] Prisma migrations completed");

  console.info("[startup] Initializing administrator");
  await runStartupStep("Administrator initialization", process.execPath, ["./scripts/init-admin.mjs"]);
  console.info("[startup] Administrator initialization completed");

  const require = createRequire(import.meta.url);
  const next = require.resolve("next/dist/bin/next");
  console.info(`[startup] Starting web server on 0.0.0.0:${port}`);
  const server = spawn(
    process.execPath,
    [next, "start", "-H", "0.0.0.0", "-p", String(port)],
    { env: process.env, stdio: "inherit" },
  );

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.kill(signal));
  }

  server.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

start().catch((error) => {
  console.error("[startup] Startup failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: safeStartupMessage(error, "Database migration or administrator initialization failed."),
  });
  process.exitCode = 1;
});
