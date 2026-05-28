-- Receptionist portal login: role on users + link from receptionists to portal account.
-- Run in Neon SQL Editor after 039-receptionist-pay-mode.sql.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_role TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_role_check
  CHECK (account_role IN ('owner', 'receptionist'));

ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receptionists_portal_user
  ON receptionists(portal_user_id)
  WHERE portal_user_id IS NOT NULL;

COMMENT ON COLUMN users.account_role IS 'owner = business dashboard; receptionist = /receptionist payout portal.';
COMMENT ON COLUMN receptionists.portal_user_id IS 'Login user id for this receptionist workspace (unique when set).';
