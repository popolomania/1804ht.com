#!/usr/bin/env node
/**
 * Smoke test — boots dist/index.cjs and validates /api/listings
 *
 * Usage:  node script/smoke-test.mjs
 * CI:     runs automatically before Railway deploy (see .github/workflows/deploy.yml)
 *
 * The script:
 *  1. Spawns the production build on a random high port
 *  2. Polls until the server is ready (up to 15 s)
 *  3. GET /api/listings  →  must return HTTP 200 + a JSON array
 *  4. GET /api/listings/featured  →  must return HTTP 200 + a JSON array
 *  5. Kills the server and exits 0 on pass, 1 on any failure
 *
 * DATABASE_URL is required even for the smoke test because the binary
 * connects on startup.  In CI the Railway Postgres plugin provides it
 * automatically.  Locally, export DATABASE_URL before running.
 */

import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const PORT = 19804; // unlikely to collide with anything
const BASE = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 300;

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[smoke] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[smoke] FAIL — ${msg}\n`);
  process.exit(1);
}

async function waitForReady(startedAt) {
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    try {
      const r = await fetch(`${BASE}/api/listings`);
      if (r.status < 500) return; // server is up (even a 4xx means it's listening)
    } catch {
      // ECONNREFUSED — not up yet
    }
    await sleep(POLL_INTERVAL_MS);
  }
  fail(`Server did not become ready within ${READY_TIMEOUT_MS / 1000}s`);
}

async function checkRoute(path, label) {
  const r = await fetch(`${BASE}${path}`);
  if (r.status !== 200) {
    fail(`${label} returned HTTP ${r.status} (expected 200)`);
  }
  const body = await r.json();
  if (!Array.isArray(body)) {
    fail(`${label} did not return a JSON array — got: ${JSON.stringify(body).slice(0, 120)}`);
  }
  log(`✓  ${label}  →  HTTP 200, array(${body.length})`);
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL is not set — export it before running the smoke test");
}

log(`Booting production build on port ${PORT}…`);

const server = spawn("node", ["dist/index.cjs"], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (d) => { serverOutput += d; });
server.stderr.on("data", (d) => { serverOutput += d; });

server.on("exit", (code, signal) => {
  if (code !== null && code !== 0) {
    process.stderr.write(`[smoke] Server exited unexpectedly (code ${code}):\n${serverOutput}\n`);
    process.exit(1);
  }
});

// Ensure the child is always cleaned up on exit
function cleanup() {
  try { server.kill("SIGTERM"); } catch {}
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });

const startedAt = Date.now();
await waitForReady(startedAt);
log(`Server ready in ${Date.now() - startedAt}ms`);

await checkRoute("/api/listings", "GET /api/listings");
await checkRoute("/api/listings/featured", "GET /api/listings/featured");

cleanup();

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
log(`All checks passed in ${elapsed}s ✓`);
process.exit(0);
