-- ============================================
-- 053 — Receptionist invitations (EMAIL / SMS onboarding)
-- ============================================
-- The app creates this table automatically at runtime (ensureInvitationsTable in
-- lib/invitations.ts via CREATE TABLE IF NOT EXISTS), so running this is OPTIONAL — it's
-- provided for parity / so you can pre-create it in Neon. Idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL,                       -- email address or E.164 phone number
  type TEXT NOT NULL DEFAULT 'EMAIL' CHECK (type IN ('EMAIL', 'SMS')),
  token TEXT NOT NULL UNIQUE,                 -- crypto.randomUUID() lookup token
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL             -- 48 hours from creation (set by the app)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);

COMMENT ON TABLE invitations IS 'Admin-issued receptionist invites (EMAIL/SMS) redeemed at /register?token=…';
