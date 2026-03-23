-- ============================================
-- Telnyx Voice AI: break /incoming ↔ /ai-bridge redirect loops
-- ============================================
-- Telnyx may POST /api/voice/telnyx/incoming many times per PSTN call. If every
-- response is <Redirect> to /ai-bridge, the platform can loop (caller hears one
-- ring then silence). We INSERT once per call_sid; only the first INSERT wins
-- → return Redirect; later POSTs return <Connect> on /incoming instead.

CREATE TABLE IF NOT EXISTS telnyx_ai_incoming_handoff (
  call_sid TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  incoming_hits INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS telnyx_ai_incoming_handoff_created_at_idx
  ON telnyx_ai_incoming_handoff (created_at);

-- Optional housekeeping (run manually in Neon if the table grows large):
-- DELETE FROM telnyx_ai_incoming_handoff WHERE created_at < now() - interval '7 days';
