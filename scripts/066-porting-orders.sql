-- 066: Native LNP porting orders (replaces external Twilio webhook forwarding).
-- Run in Neon SQL Editor after 065-organizations-external-lines.sql.

CREATE TABLE IF NOT EXISTS porting_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  current_carrier TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  pin_or_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  telnyx_order_id TEXT,
  telnyx_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS porting_orders_owner_idx ON porting_orders (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS porting_orders_org_idx ON porting_orders (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS porting_orders_telnyx_idx ON porting_orders (telnyx_order_id) WHERE telnyx_order_id IS NOT NULL;

COMMENT ON TABLE porting_orders IS 'Formal Telnyx LNP port requests submitted from the owner dashboard.';
