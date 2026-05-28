-- Dedicated dispatch SMS number for lead alerts (falls back to notification_phone / profile phone).
-- Run in Neon SQL Editor after 044-sms-lead-notifications.sql.

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS dispatch_sms_phone TEXT;

COMMENT ON COLUMN onboarding_profiles.dispatch_sms_phone IS
  'Optional dispatch-only SMS target. When blank, lead alerts use notification_phone then users.phone.';
