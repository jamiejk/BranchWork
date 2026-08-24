#!/usr/bin/env node
// Pre-flight: find a free port, then start the web app on it.
// Usage: node scripts/dev.mjs [--port <base>]   (default base: PORT env or 3210)

import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = path.join(ROOT, "apps", "web");
const NEXT_BIN = path.join(ROOT, "node_modules", ".bin", "next");
const MAX_ATTEMPTS = 50;

function parseBasePort() {
  const flagIndex = process.argv.indexOf("--port");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return Number(process.argv[flagIndex + 1]);
  }
  const positional = process.argv[2] && !isNaN(Number(process.argv[2])) ? Number(process.argv[2]) : null;
  if (positional !== null) return positional;
  if (process.env.PORT && !isNaN(Number(process.env.PORT))) return Number(process.env.PORT);
  return 3210;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host: "0.0.0.0" });
  });
}

async function findFreePort(base) {
  for (let candidate = base; candidate < base + MAX_ATTEMPTS; candidate++) {
    if (candidate < 1024 || candidate > 65535) continue;
    if (await isPortFree(candidate)) return candidate;
  }
  return null;
}

const base = parseBasePort();
const port = await findFreePort(base);
if (port === null) {
  console.error(`[preflight] No free port found in range ${base}-${base + MAX_ATTEMPTS - 1}.`);
  process.exit(1);
}
if (port !== base) {
  console.log(`[preflight] Port ${base} is busy — using ${port} instead.`);
}
const prod = process.argv.includes("--prod");
const command = prod ? "start" : "dev";
console.log(`[preflight] Starting web app (${command}) on http://localhost:${port}`);

const child = spawn(NEXT_BIN, [command, "--port", String(port)], {
  cwd: WEB_DIR,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
child.on("exit", (code) => process.exit(code ?? 0));
