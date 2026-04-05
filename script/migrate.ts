/**
 * script/migrate.ts
 *
 * Runs drizzle-kit push against the live DATABASE_URL and exits.
 * Called as `npm run migrate` — designed to be the first step of
 * the Render start command:
 *
 *   npm run migrate && npm start
 *
 * This ensures every deploy automatically applies any pending schema
 * changes before the server boots and starts accepting traffic.
 *
 * drizzle-kit push is idempotent: if the schema is already in sync
 * it does nothing and exits 0.
 */

import { execSync } from "child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set — skipping migration");
  // Exit 0 so the server still starts in environments without a DB (e.g. CI build step)
  process.exit(0);
}

console.log("[migrate] Running db:push against production database…");

try {
  execSync("npx drizzle-kit push --force", {
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("[migrate] Schema is up to date.");
  process.exit(0);
} catch (err: any) {
  console.error("[migrate] FAILED:", err.message);
  // Exit 1 — prevents the server from starting with a broken schema
  process.exit(1);
}
