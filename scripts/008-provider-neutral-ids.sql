-- Migrate legacy Twilio-specific IDs to provider-neutral columns.
-- Safe to run multiple times.

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS provider_number_sid TEXT;

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS provider_call_sid TEXT;

-- Backfill from legacy columns where needed.
UPDATE phone_numbers
SET provider_number_sid = twilio_sid
WHERE (provider_number_sid IS NULL OR provider_number_sid = '')
  AND twilio_sid IS NOT NULL
  AND twilio_sid <> '';

UPDATE call_logs
SET provider_call_sid = twilio_call_sid
WHERE (provider_call_sid IS NULL OR provider_call_sid = '')
  AND twilio_call_sid IS NOT NULL
  AND twilio_call_sid <> '';

-- Helpful indexes for webhook/status lookups.
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider_sid ON phone_numbers(provider_number_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_provider_sid ON call_logs(provider_call_sid);
