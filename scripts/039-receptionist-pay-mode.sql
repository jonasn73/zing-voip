-- Receptionist payout mode: flat fee per answered call vs per-minute rate.
-- Run in Neon SQL Editor after 038-phone-numbers-released-status.sql.

ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS pay_mode TEXT NOT NULL DEFAULT 'PER_MINUTE',
  ADD COLUMN IF NOT EXISTS flat_rate_usd NUMERIC(6, 2) NOT NULL DEFAULT 2.50;

ALTER TABLE receptionists
  DROP CONSTRAINT IF EXISTS receptionists_pay_mode_check;

ALTER TABLE receptionists
  ADD CONSTRAINT receptionists_pay_mode_check
  CHECK (pay_mode IN ('FLAT_RATE', 'PER_MINUTE'));

COMMENT ON COLUMN receptionists.pay_mode IS 'FLAT_RATE = fixed USD per answered call; PER_MINUTE = rate_per_minute * talk minutes.';
COMMENT ON COLUMN receptionists.flat_rate_usd IS 'USD paid per answered call when pay_mode = FLAT_RATE.';
