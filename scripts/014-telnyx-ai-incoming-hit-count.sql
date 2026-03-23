-- ============================================
-- Telnyx AI /incoming handoff — count repeats per call
-- ============================================
-- Used with bumpTelnyxAiIncomingHitCount(): hit 1 = silent redirect to /ai-bridge;
-- hit 2+ = short Say + Redirect (Telnyx rejects <Connect> on repeat /incoming — generic
-- "application error" audio). Optional cap uses incoming_hits in app code.

ALTER TABLE telnyx_ai_incoming_handoff
  ADD COLUMN IF NOT EXISTS incoming_hits INT NOT NULL DEFAULT 1;
