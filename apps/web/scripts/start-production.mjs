import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { assertAuthenticationEnvironment } from "../lib/env.mjs";

const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);

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

async function start() {
  assertAuthenticationEnvironment();
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  await run(npx, ["prisma", "migrate", "deploy", "--schema", "../../packages/database/prisma/schema.prisma"]);
  await run(process.execPath, ["./scripts/init-admin.mjs"]);

  const require = createRequire(import.meta.url);
  const next = require.resolve("next/dist/bin/next");
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
  console.error("[startup] Unable to start application", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: isConfigurationError(error) ? error.message : "Database migration or administrator initialization failed.",
  });
  process.exitCode = 1;
});
