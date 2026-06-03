-- 060: Hands-free voice wrap-up for mobile operators.
-- Run in Neon SQL Editor after 059-cell-fallback-dispositions.sql.
--
-- After a mobile operator's bridged call ends, Lyncr can place an outbound "wrap-up callback"
-- (POST /api/voice/telnyx/wrapup) that gathers the disposition by voice/DTMF and records a spoken
-- job note. The note is transcribed in the background and stored in call_logs.internal_notes.
--
--   call_logs.internal_notes        : operator's transcribed job details
--   receptionists.is_mobile_operator : opt this agent into the voice wrap-up callback flow
--
-- NOTE: the disposition_status lives in call_logs.disposition (added in 059) — reused here.

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS is_mobile_operator BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN call_logs.internal_notes IS 'Operator job notes (transcribed from the voice wrap-up callback).';
COMMENT ON COLUMN receptionists.is_mobile_operator IS 'TRUE = field/mobile agent eligible for the hands-free voice wrap-up callback.';
