/**
 * server/migrate.ts
 *
 * Runs idempotent schema migrations using raw SQL via the postgres driver.
 * Called automatically on server startup (before any routes handle requests).
 *
 * WHY raw SQL instead of drizzle-kit push?
 *   drizzle-kit is a devDependency (build tool). It's not installed in
 *   production (npm ci --omit=dev), so calling it at runtime crashes.
 *   This file uses only `postgres` which IS a production dependency.
 *
 * Every statement uses IF NOT EXISTS / DO blocks so it's safe to run
 * on every deploy — a no-op when the schema is already current.
 */

import postgres from "postgres";

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] No DATABASE_URL — skipping migrations");
    return;
  }

  const sql = postgres(url, { max: 1 });

  try {
    console.log("[migrate] Running schema migrations…");

    // ── users table ─────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id                    SERIAL PRIMARY KEY,
        name                  TEXT NOT NULL,
        email                 TEXT NOT NULL UNIQUE,
        password_hash         TEXT NOT NULL,
        role                  TEXT NOT NULL DEFAULT 'guest',
        phone                 TEXT,
        email_verified        BOOLEAN NOT NULL DEFAULT false,
        verify_token          TEXT,
        verify_token_expiry   TIMESTAMP,
        account_status        TEXT NOT NULL DEFAULT 'approved',
        admin_notes           TEXT,
        reviewed_at           TIMESTAMP,
        reviewed_by           INTEGER,
        upgrade_requested_at  TIMESTAMP,
        upgrade_reason        TEXT,
        created_at            TIMESTAMP DEFAULT NOW()
      )
    `;

    // Add columns that may be missing in existing deployments (all idempotent)
    const alterUsers = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expiry TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'approved'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by INTEGER`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_requested_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_reason TEXT`,
    ];

    for (const stmt of alterUsers) {
      await sql.unsafe(stmt);
    }

    // ── listings table ───────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS listings (
        id             SERIAL PRIMARY KEY,
        title          TEXT NOT NULL,
        description    TEXT NOT NULL,
        price          REAL NOT NULL,
        price_type     TEXT NOT NULL DEFAULT 'sale',
        address        TEXT NOT NULL,
        city           TEXT NOT NULL,
        department     TEXT NOT NULL,
        property_type  TEXT NOT NULL,
        bedrooms       INTEGER,
        bathrooms      INTEGER,
        area_sqm       REAL,
        lat            REAL,
        lng            REAL,
        images         TEXT NOT NULL DEFAULT '[]',
        amenities      TEXT NOT NULL DEFAULT '[]',
        status         TEXT NOT NULL DEFAULT 'active',
        featured       BOOLEAN DEFAULT false,
        contact_name   TEXT NOT NULL,
        contact_phone  TEXT NOT NULL,
        contact_email  TEXT,
        owner_id       INTEGER
      )
    `;

    await sql.unsafe(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id INTEGER`);

    // ── saved_listings table ─────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS saved_listings (
        id          SERIAL PRIMARY KEY,
        listing_id  INTEGER NOT NULL,
        session_id  TEXT NOT NULL
      )
    `;

    // ── Backfill: existing agents get 'approved' if account_status is blank ──
    await sql`
      UPDATE users
      SET account_status = 'approved'
      WHERE role = 'agent'
        AND (account_status IS NULL OR account_status = '')
    `;

    // ── Backfill: existing guests are auto-verified ──────────────────────────
    await sql`
      UPDATE users
      SET email_verified = true
      WHERE role = 'guest'
        AND email_verified = false
    `;

    console.log("[migrate] Schema is up to date ✓");
  } catch (e: any) {
    console.error("[migrate] FAILED:", e.message);
    throw e; // Re-throw — server should not start with a broken schema
  } finally {
    await sql.end();
  }
}
