-- Instant SMS lead alerts — owner notification preferences on onboarding_profiles.
-- Run in Neon SQL Editor after 043-certifications-training.sql.

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS sms_leads_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_phone TEXT;

COMMENT ON COLUMN onboarding_profiles.sms_leads_enabled IS
  'When true, send Telnyx SMS to notification_phone after AI call intake saves a lead.';
COMMENT ON COLUMN onboarding_profiles.notification_phone IS
  'E.164 or US mobile number where instant lead alert texts are delivered.';
