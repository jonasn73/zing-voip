-- 064: Hands-free field-technician SMS invite links.
-- Run in Neon SQL Editor (safe to run even if 054 already added these columns).
--
-- Field techs are now provisioned WITHOUT a password. The owner enters first name, last name and
-- mobile number; we create a stub `users` row (account_role = 'field_tech', invite_status = 'invited')
-- carrying a one-time invite token + 48h expiry, then text the tech a /tech/setup?token=… link where
-- they pick their own password. We reuse the same invite columns the receptionist flow uses (054).

ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_status TEXT;

-- One pending invite per token (real accounts have token NULL and stay out of the index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invitation_token
  ON users (invitation_token)
  WHERE invitation_token IS NOT NULL;

COMMENT ON COLUMN users.invite_status IS 'NULL = normal account; invited = stub awaiting onboarding; active = onboarded receptionist/technician.';
