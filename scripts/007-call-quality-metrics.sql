-- Add call quality timing metrics to call_logs
-- These fields let us measure setup latency and answer rate from real traffic.

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS first_ring_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS post_dial_delay_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_call_logs_answered_at ON call_logs(user_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_first_ring_at ON call_logs(user_id, first_ring_at DESC);
