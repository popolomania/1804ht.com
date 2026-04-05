-- Migration: Add email verification + admin dashboard columns to users table
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- Run this in your Render Postgres shell after deploying the latest code.

-- 1. Email verification (added in feat/email-verification)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expiry TIMESTAMP;

-- 2. Admin dashboard (added in feat/admin-dashboard)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;

-- 3. Listings owner FK (added in feat/auth)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- 4. Backfill: existing agents should be marked as approved
--    (they predate the admin review system)
UPDATE users SET account_status = 'approved'
  WHERE role = 'agent' AND account_status = 'approved';

-- 5. Backfill: existing guests are auto-verified
UPDATE users SET email_verified = true
  WHERE role = 'guest' AND email_verified = false;

-- 6. Guest-to-agent upgrade request fields (added in feat/guest-upgrade)
ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_requested_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_reason TEXT;

SELECT 'Migration complete.' AS status;
