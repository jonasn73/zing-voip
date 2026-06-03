-- 056: Owner dispatch-alert preferences for the live operator network.
-- Run in Neon SQL Editor after 055-routing-instructions.sql.
--
-- email_recordings_enabled: when true, the owner is emailed an mp3 playback link for completed calls.
-- (SMS lead notifications already persist via onboarding_profiles.sms_leads_enabled.)

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS email_recordings_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN onboarding_profiles.email_recordings_enabled IS 'Email mp3 call recordings to the owner''s primary address when an operator call completes.';
