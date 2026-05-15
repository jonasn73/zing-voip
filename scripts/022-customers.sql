-- ============================================
-- 022 — Per-account customer records (CRM-lite)
-- ============================================
-- Saved from the answered-call sheet and searchable on /dashboard/customers.
-- Run in Neon → SQL Editor after prior migrations.

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'US',
  notes TEXT NOT NULL DEFAULT '',
  source_last_call_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_user_phone_unique UNIQUE (user_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_customers_user_updated ON customers (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_user_phone ON customers (user_id, phone_e164);
