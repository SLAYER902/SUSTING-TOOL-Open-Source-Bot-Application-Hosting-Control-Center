import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT must be an integer from 1 to 65535; received "${rawPort}".`);
}

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
