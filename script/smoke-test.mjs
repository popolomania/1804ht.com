#!/usr/bin/env node
/**
 * Smoke test — boots dist/index.cjs and validates all critical API routes
 *
 * Usage:  npm run smoke            (requires DATABASE_URL and a prior npm run build)
 * CI:     runs automatically before Render deploy (see .github/workflows/deploy.yml)
 *
 * Test plan:
 *   PREFLIGHT
 *     DATABASE_URL is set and valid
 *     Server starts and DB is reachable within 15s
 *
 *   READ PATH
 *     GET  /api/listings           → 200, JSON array
 *     GET  /api/listings/featured  → 200, JSON array
 *     GET  /api/listings?filters   → 200, filtered array
 *
 *   WRITE PATH (full round-trip, self-cleaning)
 *     POST /api/listings           → 201, correct fields
 *     GET  /api/listings/:id       → 200
 *     POST /api/listings (bad)     → 400
 *     DELETE /api/listings/:id     → 204
 *     GET  /api/listings/:id       → 404
 *
 *   SAVED PATH
 *     POST/GET /api/saved toggle round-trip
 *
 *   AUTH — AGENT APPROVAL FLOW (full end-to-end)
 *     Register as guest              → 201, emailVerified=true, accountStatus=approved
 *     Register as agent              → 201, emailVerified=false, accountStatus=pending
 *     Login with wrong password      → 401
 *     Login with correct password    → 200, user returned
 *     GET /api/auth/me while logged in → 200
 *     GET /api/auth/me while logged out → 401
 *     Unverified agent tries to publish → 403 (email not verified)
 *     Simulate email verify via token    → redirect to /#/verify?success=1
 *     Verified-but-pending agent tries to publish → 403 (pending approval)
 *     Admin approves the agent           → agent accountStatus=approved
 *     Approved agent publishes a listing → 201
 *     Admin suspends the agent           → accountStatus=suspended
 *     Suspended agent tries to publish   → 403
 *     Admin reinstates the agent         → accountStatus=approved
 *     Admin tries to approve themselves  → 400
 *     Admin deletes the test agent       → 204
 *     Admin deletes the test listing     → 204
 *     Guest logout                       → 200
 */

import { spawn }                  from "child_process";
import { setTimeout as sleep }    from "timers/promises";

const PORT          = 19804;
const BASE          = `http://localhost:${PORT}`;
const READY_TIMEOUT = 15_000;
const POLL_INTERVAL = 300;

// ── assertion helpers ─────────────────────────────────────────────────────────

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

// ── DATABASE_URL preflight ────────────────────────────────────────────────────

function checkDatabaseUrl() {
  log("PREFLIGHT");

  const url = process.env.DATABASE_URL;

  ok("DATABASE_URL is set", !!url,
    "export DATABASE_URL=postgresql://user:pass@host:5432/dbname");
  if (!url) die("DATABASE_URL is required — aborting");

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    ok("DATABASE_URL is a valid URL", false, `could not parse: ${url}`);
    die("DATABASE_URL is not a valid URL");
  }

  ok("DATABASE_URL is a valid URL", true);

  const validSchemes = ["postgresql:", "postgres:"];
  ok(
    `DATABASE_URL scheme is postgresql:// or postgres://`,
    validSchemes.includes(parsed.protocol),
    `got '${parsed.protocol}' — must be postgresql:// or postgres://`
  );

  ok(
    "DATABASE_URL has a non-empty host",
    !!parsed.hostname,
    "host is empty — check the URL format"
  );

  const port = parsed.port || "5432";
  ok(
    `DATABASE_URL port is numeric (${port})`,
    /^\d+$/.test(port) && Number(port) > 0 && Number(port) < 65536,
    `got '${port}'`
  );

  ok(
    "DATABASE_URL has a database name",
    parsed.pathname.length > 1,
    `pathname is '${parsed.pathname}' — expected /dbname`
  );

  if (failed > 0) die("DATABASE_URL preflight failed — fix the connection string before deploying");
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/**
 * Make a request, optionally carrying a cookie jar for session persistence.
 * cookieJar is a plain object { [name]: value } shared across calls in a session.
 */
async function req(method, path, body, cookieJar) {
  const headers = { "Content-Type": "application/json" };

  // Attach cookies from jar
  if (cookieJar && Object.keys(cookieJar).length > 0) {
    headers["Cookie"] = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const r = await fetch(`${BASE}${path}`, opts);

  // Harvest Set-Cookie headers into jar
  if (cookieJar) {
    const setCookie = r.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq !== -1) {
        cookieJar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    }
  }

  let json;
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) json = await r.json();

  return { status: r.status, body: json, headers: r.headers };
}

// ── wait for server ───────────────────────────────────────────────────────────

async function waitForReady(startedAt, serverExited) {
  while (Date.now() - startedAt < READY_TIMEOUT) {
    if (serverExited.code !== null) {
      die(
        `Server process exited prematurely (code ${serverExited.code}) — ` +
        `likely a startup crash. Server output:\n${serverExited.output}`
      );
    }

    try {
      const r = await fetch(`${BASE}/api/listings`);
      if (r.status === 200) {
        ok("Server started and DB connection resolved (lazy init works)", true);
        return;
      }
      if (r.status === 500) {
        const body = await r.json().catch(() => ({}));
        const hint = body?.error || "unknown error";
        if (Date.now() - startedAt > 3_000) {
          ok(
            "Server started and DB connection resolved (lazy init works)",
            false,
            `GET /api/listings returned 500: ${hint} — check DATABASE_URL`
          );
          die("DB connection failed — fix DATABASE_URL before deploying");
        }
      }
    } catch { /* ECONNREFUSED — not up yet */ }
    await sleep(POLL_INTERVAL);
  }
  ok("Server started and DB connection resolved", false,
    `timed out after ${READY_TIMEOUT / 1000}s`);
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

  const created = await req("POST", "/api/listings", SAMPLE_LISTING);
  ok("POST /api/listings → 201", created.status === 201);
  ok("POST /api/listings → has id", typeof created.body?.id === "number");
  ok("POST /api/listings → correct title", created.body?.title === SAMPLE_LISTING.title);
  ok("POST /api/listings → correct price", created.body?.price === SAMPLE_LISTING.price);
  ok("POST /api/listings → correct department", created.body?.department === SAMPLE_LISTING.department);
  const id = created.body?.id;

  if (id !== undefined) {
    const fetched = await req("GET", `/api/listings/${id}`);
    ok("GET /api/listings/:id → 200", fetched.status === 200);
    ok("GET /api/listings/:id → same listing", fetched.body?.id === id);

    const bad = await req("POST", "/api/listings", { title: "incomplete" });
    ok("POST /api/listings (bad body) → 400", bad.status === 400);
    ok("POST /api/listings (bad body) → not 500", bad.status !== 500);

    const deleted = await req("DELETE", `/api/listings/${id}`);
    ok("DELETE /api/listings/:id → 204", deleted.status === 204);

    const gone = await req("GET", `/api/listings/${id}`);
    ok("GET /api/listings/:id after delete → 404", gone.status === 404);

    const notFound = await req("DELETE", `/api/listings/${id}`);
    ok("DELETE /api/listings/:id (again) → 404", notFound.status === 404);
  } else {
    for (let i = 0; i < 6; i++) ok("(skipped — POST failed)", false, "id was undefined");
  }
}

async function testSavedPath() {
  log("SAVED PATH");

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

  await req("DELETE", `/api/listings/${listingId}`);
}

// ── AUTH — AGENT APPROVAL FLOW ────────────────────────────────────────────────

async function testAuthAgentApprovalFlow() {
  log("AUTH — AGENT APPROVAL FLOW");

  // Each actor gets their own cookie jar so sessions don't bleed across
  const guestJar  = {};
  const agentJar  = {};
  const adminJar  = {};

  const ts             = Date.now();
  const GUEST_EMAIL    = `smoke-guest-${ts}@test.invalid`;
  const AGENT_EMAIL    = `smoke-agent-${ts}@test.invalid`;
  const GUEST_PASS     = "GuestPass123";
  const AGENT_PASS     = "AgentPass123";
  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@1804ht.com";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "smoke-admin-pass";

  let agentId         = null;
  let smokeListingId  = null;

  // ── 1. Register guest ──────────────────────────────────────────────────────
  const guestReg = await req("POST", "/api/auth/register", {
    name: "Smoke Guest",
    email: GUEST_EMAIL,
    password: GUEST_PASS,
    role: "guest",
  }, guestJar);

  ok("Register guest → 201",            guestReg.status === 201);
  ok("Register guest → emailVerified",  guestReg.body?.emailVerified === true);
  ok("Register guest → accountStatus=approved", guestReg.body?.accountStatus === "approved");
  ok("Register guest → no pendingVerification", !guestReg.body?.pendingVerification);

  // ── 2. Register agent ──────────────────────────────────────────────────────
  const agentReg = await req("POST", "/api/auth/register", {
    name: "Smoke Agent",
    email: AGENT_EMAIL,
    password: AGENT_PASS,
    role: "agent",
  }, agentJar);

  ok("Register agent → 201",                  agentReg.status === 201);
  ok("Register agent → emailVerified=false",  agentReg.body?.emailVerified === false);
  ok("Register agent → accountStatus=pending", agentReg.body?.accountStatus === "pending");
  ok("Register agent → pendingVerification",   agentReg.body?.pendingVerification === true);
  ok("Register agent → verifyToken not exposed", !("verifyToken" in (agentReg.body ?? {})));
  agentId = agentReg.body?.id;

  // ── 3. Login errors ────────────────────────────────────────────────────────
  const badLogin = await req("POST", "/api/auth/login", {
    email: AGENT_EMAIL,
    password: "wrong-password",
  });
  ok("Login wrong password → 401", badLogin.status === 401);
  ok("Login wrong password → error message", typeof badLogin.body?.error === "string");

  // ── 4. Re-login agent (was auto-logged in on register, re-test explicitly) ──
  const freshAgentJar = {};
  const agentLogin = await req("POST", "/api/auth/login", {
    email: AGENT_EMAIL,
    password: AGENT_PASS,
  }, freshAgentJar);
  ok("Agent login → 200",               agentLogin.status === 200);
  ok("Agent login → correct email",     agentLogin.body?.email === AGENT_EMAIL);
  ok("Agent login → no passwordHash",   !("passwordHash" in (agentLogin.body ?? {})));
  ok("Agent login → no verifyToken",    !("verifyToken" in (agentLogin.body ?? {})));

  // ── 5. GET /me ─────────────────────────────────────────────────────────────
  const me = await req("GET", "/api/auth/me", undefined, freshAgentJar);
  ok("GET /api/auth/me (logged in) → 200",  me.status === 200);
  ok("GET /api/auth/me → correct role",     me.body?.role === "agent");

  const meGuest = await req("GET", "/api/auth/me");
  ok("GET /api/auth/me (no session) → 401", meGuest.status === 401);

  // ── 6. Unverified agent tries to publish ───────────────────────────────────
  const unverifiedPublish = await req("POST", "/api/listings", {
    ...SAMPLE_LISTING,
    title: "Unverified Agent Listing (should fail)",
  }, freshAgentJar);
  ok("Unverified agent publish → 403", unverifiedPublish.status === 403);

  // ── 7. Simulate email verification ─────────────────────────────────────────
  // Fetch the verify token directly from the DB via the admin API.
  // We first need an admin session, so bootstrap the admin and log in.

  // Ensure admin account exists (bootstrapAdmin ran on startup if env vars set).
  // If ADMIN_EMAIL/ADMIN_PASSWORD are not configured, we still test what we can.
  const adminLogin = await req("POST", "/api/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }, adminJar);

  const adminAvailable = adminLogin.status === 200 && adminLogin.body?.role === "admin";
  ok("Admin login → 200",    adminAvailable, `HTTP ${adminLogin.status} — set ADMIN_EMAIL + ADMIN_PASSWORD env vars`);
  ok("Admin login → admin role", adminAvailable, adminLogin.body?.role);

  // We can't call the DB directly in the smoke test, but we CAN use the
  // verify endpoint by reading the token from the admin agents list.
  // The token is NOT returned by the API (it's stripped in safeUser),
  // so we simulate verification by hitting GET /api/auth/verify/:token
  // after extracting it from the DB via the internal resend route.

  // ── 7a. Resend verification (issues a fresh token, easier to intercept) ────
  const resend = await req("POST", "/api/auth/resend-verification", undefined, freshAgentJar);
  ok("Resend verification → 200", resend.status === 200);

  // ── 7b. Fetch the raw token from Postgres via psql ─────────────────────────
  // We use a small inline node script to query the DB directly.
  // This is acceptable in a smoke test that already has DATABASE_URL.
  const { execSync } = await import("child_process");
  let verifyToken = null;
  try {
    const result = execSync(
      `node -e "
        import('postgres').then(({ default: postgres }) => {
          const sql = postgres(process.env.DATABASE_URL);
          sql\`SELECT verify_token FROM users WHERE email = '${AGENT_EMAIL}'\`
            .then(rows => { console.log(rows[0]?.verify_token ?? ''); sql.end(); })
            .catch(e => { console.error(e.message); sql.end(); process.exit(1); });
        });
      "`,
      { env: process.env, encoding: "utf8" }
    ).trim();
    verifyToken = result || null;
  } catch (e) {
    ok("Fetch verify token from DB", false, e.message);
  }

  ok("Verify token exists in DB", !!verifyToken);

  if (verifyToken) {
    // ── 7c. Hit the verify endpoint (it redirects) ─────────────────────────
    const verifyResp = await fetch(`${BASE}/api/auth/verify/${verifyToken}`, {
      redirect: "manual",
    });
    ok("GET /api/auth/verify/:token → redirect", verifyResp.status === 302 || verifyResp.status === 301);
    const location = verifyResp.headers.get("location") ?? "";
    ok("GET /api/auth/verify/:token → success redirect", location.includes("success=1"),
      `got: ${location}`);

    // Re-login to get a fresh session that reflects emailVerified=true
    const freshAgentJar2 = {};
    await req("POST", "/api/auth/login", {
      email: AGENT_EMAIL,
      password: AGENT_PASS,
    }, freshAgentJar2);

    // ── 8. Verified-but-pending agent still can't publish ──────────────────
    const pendingPublish = await req("POST", "/api/listings", {
      ...SAMPLE_LISTING,
      title: "Pending Agent Listing (should fail)",
    }, freshAgentJar2);
    ok("Verified-but-pending agent publish → 403", pendingPublish.status === 403);
    ok("Pending error message mentions approbation",
      pendingPublish.body?.error?.toLowerCase().includes("attente") ||
      pendingPublish.body?.error?.toLowerCase().includes("approbation") ||
      pendingPublish.body?.error?.toLowerCase().includes("pending"),
      `got: ${pendingPublish.body?.error}`);

    if (adminAvailable) {
      // ── 9. Admin approves the agent ───────────────────────────────────────
      const approve = await req("PATCH", `/api/admin/users/${agentId}/status`,
        { status: "approved" }, adminJar);
      ok("Admin approve agent → 200",         approve.status === 200);
      ok("Admin approve → accountStatus=approved", approve.body?.accountStatus === "approved");

      // Re-login agent after approval
      const approvedJar = {};
      await req("POST", "/api/auth/login", {
        email: AGENT_EMAIL,
        password: AGENT_PASS,
      }, approvedJar);

      // ── 10. Approved agent publishes a listing ────────────────────────────
      const publish = await req("POST", "/api/listings", {
        ...SAMPLE_LISTING,
        title: "Smoke Agent Approved Listing",
      }, approvedJar);
      ok("Approved agent publish → 201", publish.status === 201);
      ok("Published listing has correct title",
        publish.body?.title === "Smoke Agent Approved Listing");
      smokeListingId = publish.body?.id;

      // ── 11. Admin stats reflect the new listing ───────────────────────────
      const stats = await req("GET", "/api/admin/stats", undefined, adminJar);
      ok("GET /api/admin/stats → 200", stats.status === 200);
      ok("Admin stats has users.agents count", typeof stats.body?.users?.agents === "number");
      ok("Admin stats has agents.approved count", typeof stats.body?.agents?.approved === "number");
      ok("Admin stats has listings.total count", typeof stats.body?.listings?.total === "number");

      // ── 12. Admin agents list ─────────────────────────────────────────────
      const agentsList = await req("GET", "/api/admin/agents?status=approved", undefined, adminJar);
      ok("GET /api/admin/agents → 200", agentsList.status === 200);
      ok("Admin agents list → JSON array", Array.isArray(agentsList.body));
      ok("Admin agents list includes smoke agent",
        Array.isArray(agentsList.body) && agentsList.body.some(u => u.email === AGENT_EMAIL));

      // ── 13. Admin suspends the agent ──────────────────────────────────────
      const suspend = await req("PATCH", `/api/admin/users/${agentId}/status`,
        { status: "suspended" }, adminJar);
      ok("Admin suspend agent → 200",          suspend.status === 200);
      ok("Admin suspend → accountStatus=suspended", suspend.body?.accountStatus === "suspended");

      // Suspended agent re-logins and tries to publish
      const suspendedJar = {};
      await req("POST", "/api/auth/login", {
        email: AGENT_EMAIL,
        password: AGENT_PASS,
      }, suspendedJar);

      const suspendedPublish = await req("POST", "/api/listings", {
        ...SAMPLE_LISTING,
        title: "Suspended Agent Listing (should fail)",
      }, suspendedJar);
      ok("Suspended agent publish → 403", suspendedPublish.status === 403);
      ok("Suspended error message mentions suspension",
        suspendedPublish.body?.error?.toLowerCase().includes("suspendu") ||
        suspendedPublish.body?.error?.toLowerCase().includes("suspended") ||
        suspendedPublish.body?.error?.toLowerCase().includes("support"),
        `got: ${suspendedPublish.body?.error}`);

      // ── 14. Admin reinstates the agent ────────────────────────────────────
      const reinstate = await req("PATCH", `/api/admin/users/${agentId}/status`,
        { status: "approved" }, adminJar);
      ok("Admin reinstate agent → 200",            reinstate.status === 200);
      ok("Admin reinstate → accountStatus=approved", reinstate.body?.accountStatus === "approved");

      // ── 15. Admin cannot self-suspend ─────────────────────────────────────
      const selfSuspend = await req("PATCH", `/api/admin/users/${adminLogin.body.id}/status`,
        { status: "suspended" }, adminJar);
      ok("Admin self-suspend → 400", selfSuspend.status === 400);

      // ── 16. Admin saves internal notes ────────────────────────────────────
      const notes = await req("PATCH", `/api/admin/users/${agentId}/notes`,
        { notes: "Smoke test note — safe to ignore" }, adminJar);
      ok("Admin save notes → 200",          notes.status === 200);
      ok("Admin notes persisted",           notes.body?.adminNotes === "Smoke test note — safe to ignore");

      // ── 17. Non-admin cannot reach admin routes ───────────────────────────
      const agentHitAdmin = await req("GET", "/api/admin/stats", undefined, freshAgentJar2);
      ok("Non-admin GET /api/admin/stats → 403", agentHitAdmin.status === 403);

      // ── 18. Clean up — delete smoke listing and smoke agent ───────────────
      if (smokeListingId) {
        const delListing = await req("DELETE", `/api/admin/listings/${smokeListingId}`, undefined, adminJar);
        ok("Admin delete smoke listing → 204", delListing.status === 204);
      }

      const delAgent = await req("DELETE", `/api/admin/users/${agentId}`, undefined, adminJar);
      ok("Admin delete smoke agent → 204", delAgent.status === 204);
    }
  } else {
    // If we couldn't get the token, skip the downstream checks but count them
    const skips = adminAvailable ? 18 : 10;
    for (let i = 0; i < skips; i++) ok("(skipped — verify token unavailable)", false);
  }

  // ── 19. Guest logout ───────────────────────────────────────────────────────
  const logout = await req("POST", "/api/auth/logout", undefined, guestJar);
  ok("Guest logout → 200", logout.status === 200);
  ok("Guest logout → { ok: true }", logout.body?.ok === true);

  const meAfterLogout = await req("GET", "/api/auth/me", undefined, guestJar);
  ok("GET /api/auth/me after logout → 401", meAfterLogout.status === 401);

  // Clean up the guest account if admin is available
  if (adminAvailable && guestReg.body?.id) {
    await req("DELETE", `/api/admin/users/${guestReg.body.id}`, undefined, adminJar);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

checkDatabaseUrl();

log(`Booting production build on port ${PORT}…`);

const serverExited = { code: null, output: "" };

const server = spawn("node", ["dist/index.cjs"], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (d) => { serverExited.output += d; });
server.stderr.on("data", (d) => { serverExited.output += d; });
server.on("exit", (code) => { serverExited.code = code ?? 0; });

function cleanup() { try { server.kill("SIGTERM"); } catch {} }
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });

const startedAt = Date.now();
await waitForReady(startedAt, serverExited);
log(`Server ready and DB reachable in ${Date.now() - startedAt}ms`);

await testReadPath();
await testWritePath();
await testSavedPath();
await testAuthAgentApprovalFlow();

cleanup();

log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.stderr.write(`[smoke] ${failed} check(s) failed — blocking deploy\n`);
  process.exit(1);
}
process.stdout.write(`[smoke] All checks passed ✓\n`);
process.exit(0);
