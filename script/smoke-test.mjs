#!/usr/bin/env node
/**
 * Smoke test — boots dist/index.cjs and validates all critical API routes
 *
 * Usage:  npm run smoke            (requires DATABASE_URL and a prior npm run build)
 * CI:     runs automatically before Railway deploy (see .github/workflows/deploy.yml)
 *
 * Test plan:
 *   READ PATH
 *     GET  /api/listings           → 200, JSON array
 *     GET  /api/listings/featured  → 200, JSON array
 *     GET  /api/listings?priceType=sale&department=Nord  → 200, filtered array
 *
 *   WRITE PATH (full round-trip, no leftover data)
 *     POST /api/listings           → 201, created listing with correct fields
 *     GET  /api/listings/:id       → 200, same listing returned
 *     POST /api/listings (bad body)→ 400, validation error (not 500)
 *     DELETE /api/listings/:id     → 204
 *     GET  /api/listings/:id       → 404, listing is gone
 *
 *   SAVED PATH
 *     POST /api/saved              → { saved: true }
 *     GET  /api/saved/:sessionId/:listingId/status → { saved: true }
 *     POST /api/saved (toggle off) → { saved: false }
 */

import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const PORT          = 19804;
const BASE          = `http://localhost:${PORT}`;
const READY_TIMEOUT = 15_000;
const POLL_INTERVAL = 300;

// ── tiny assertion helpers ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    process.stdout.write(`  ✓  ${label}\n`);
    passed++;
  } else {
    process.stderr.write(`  ✗  ${label}${detail ? " — " + detail : ""}\n`);
    failed++;
  }
}

function log(msg)  { process.stdout.write(`\n[smoke] ${msg}\n`); }
function die(msg)  { process.stderr.write(`[smoke] FATAL — ${msg}\n`); process.exit(1); }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  let json;
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    json = await r.json();
  }
  return { status: r.status, body: json };
}

// ── wait for server ───────────────────────────────────────────────────────────

async function waitForReady(startedAt) {
  while (Date.now() - startedAt < READY_TIMEOUT) {
    try {
      const r = await fetch(`${BASE}/api/listings`);
      if (r.status < 500) return;
    } catch { /* ECONNREFUSED — still booting */ }
    await sleep(POLL_INTERVAL);
  }
  die(`Server did not become ready within ${READY_TIMEOUT / 1000}s`);
}

// ── test suites ───────────────────────────────────────────────────────────────

const SAMPLE_LISTING = {
  title:        "Test Smoke Listing",
  description:  "Smoke test listing — safe to delete",
  price:        99000,
  priceType:    "sale",
  address:      "1 Rue du Test",
  city:         "Cap-Haïtien",
  department:   "Nord",
  propertyType: "house",
  bedrooms:     3,
  bathrooms:    2,
  areaSqm:      120,
  lat:          19.75,
  lng:          -72.20,
  images:       "[]",
  amenities:    "[]",
  status:       "active",
  featured:     false,
  contactName:  "Smoke Test",
  contactPhone: "+509 0000-0000",
  contactEmail: null,
};

async function testReadPath() {
  log("READ PATH");

  const all = await req("GET", "/api/listings");
  ok("GET /api/listings → 200", all.status === 200);
  ok("GET /api/listings → JSON array", Array.isArray(all.body));

  const featured = await req("GET", "/api/listings/featured");
  ok("GET /api/listings/featured → 200", featured.status === 200);
  ok("GET /api/listings/featured → JSON array", Array.isArray(featured.body));

  const filtered = await req("GET", "/api/listings?priceType=sale&department=Nord");
  ok("GET /api/listings?filters → 200", filtered.status === 200);
  ok("GET /api/listings?filters → only sale listings",
    Array.isArray(filtered.body) && filtered.body.every(l => l.priceType === "sale"));
  ok("GET /api/listings?filters → only Nord department",
    Array.isArray(filtered.body) && filtered.body.every(l => l.department === "Nord"));
}

async function testWritePath() {
  log("WRITE PATH");

  // POST valid listing
  const created = await req("POST", "/api/listings", SAMPLE_LISTING);
  ok("POST /api/listings → 201", created.status === 201);
  ok("POST /api/listings → has id", typeof created.body?.id === "number");
  ok("POST /api/listings → correct title", created.body?.title === SAMPLE_LISTING.title);
  ok("POST /api/listings → correct price", created.body?.price === SAMPLE_LISTING.price);
  ok("POST /api/listings → correct department", created.body?.department === SAMPLE_LISTING.department);
  const id = created.body?.id;

  // GET the created listing
  if (id !== undefined) {
    const fetched = await req("GET", `/api/listings/${id}`);
    ok("GET /api/listings/:id → 200", fetched.status === 200);
    ok("GET /api/listings/:id → same listing", fetched.body?.id === id);

    // POST with missing required fields → validation error, not server crash
    const bad = await req("POST", "/api/listings", { title: "incomplete" });
    ok("POST /api/listings (bad body) → 400", bad.status === 400);
    ok("POST /api/listings (bad body) → not 500", bad.status !== 500);

    // DELETE the created listing
    const deleted = await req("DELETE", `/api/listings/${id}`);
    ok("DELETE /api/listings/:id → 204", deleted.status === 204);

    // Confirm it's gone
    const gone = await req("GET", `/api/listings/${id}`);
    ok("GET /api/listings/:id after delete → 404", gone.status === 404);

    // DELETE non-existent → 404
    const notFound = await req("DELETE", `/api/listings/${id}`);
    ok("DELETE /api/listings/:id (again) → 404", notFound.status === 404);
  } else {
    // If POST failed, skip dependent checks but count them as failures
    for (let i = 0; i < 6; i++) ok("(skipped — POST failed)", false, "id was undefined");
  }
}

async function testSavedPath() {
  log("SAVED PATH");

  // Need a real listing id to save
  const created = await req("POST", "/api/listings", SAMPLE_LISTING);
  const listingId = created.body?.id;
  const sessionId = "smoke-test-session-abc123";

  if (!listingId) {
    ok("(skipped — could not create listing for saved tests)", false);
    return;
  }

  const save = await req("POST", "/api/saved", { listingId, sessionId });
  ok("POST /api/saved → { saved: true }", save.body?.saved === true);

  const status = await req("GET", `/api/saved/${sessionId}/${listingId}/status`);
  ok("GET /api/saved/:session/:id/status → { saved: true }", status.body?.saved === true);

  const unsave = await req("POST", "/api/saved", { listingId, sessionId });
  ok("POST /api/saved (toggle) → { saved: false }", unsave.body?.saved === false);

  const statusAfter = await req("GET", `/api/saved/${sessionId}/${listingId}/status`);
  ok("GET /api/saved/:session/:id/status after unsave → { saved: false }", statusAfter.body?.saved === false);

  // Clean up
  await req("DELETE", `/api/listings/${listingId}`);
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  die("DATABASE_URL is not set — export it before running the smoke test");
}

log(`Booting production build on port ${PORT}…`);

const server = spawn("node", ["dist/index.cjs"], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (d) => { serverOutput += d; });
server.stderr.on("data", (d) => { serverOutput += d; });

server.on("exit", (code) => {
  if (code !== null && code !== 0) {
    process.stderr.write(`[smoke] Server crashed (exit ${code}):\n${serverOutput}\n`);
    process.exit(1);
  }
});

function cleanup() { try { server.kill("SIGTERM"); } catch {} }
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });

const startedAt = Date.now();
await waitForReady(startedAt);
log(`Server ready in ${Date.now() - startedAt}ms`);

await testReadPath();
await testWritePath();
await testSavedPath();

cleanup();

log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.stderr.write(`[smoke] ${failed} check(s) failed — blocking deploy\n`);
  process.exit(1);
}
process.stdout.write(`[smoke] All checks passed ✓\n`);
process.exit(0);
