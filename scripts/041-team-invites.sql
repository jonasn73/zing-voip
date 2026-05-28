-- Team / receptionist invite tokens for admin-issued onboarding.
-- Run in Neon SQL Editor after 040-receptionist-portal-role.sql.

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'receptionist' CHECK (role IN ('receptionist')),
  token TEXT NOT NULL UNIQUE,
  payout_rate_usd NUMERIC(6, 2) NOT NULL DEFAULT 2.50,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites (token);
CREATE INDEX IF NOT EXISTS idx_team_invites_pending ON team_invites (expires_at)
  WHERE accepted_at IS NULL;

COMMENT ON TABLE team_invites IS 'Pending receptionist invites created from /admin — redeemed at /signup?invite=token.';
COMMENT ON COLUMN team_invites.payout_rate_usd IS 'Default FLAT_RATE payout (USD) applied to the receptionist row on accept.';
