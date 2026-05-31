-- ============================================
-- 050 — Receptionist routing endpoint (WEB vs CELL)
-- ============================================
-- Run in Neon SQL Editor AFTER 049-private-ring-timeout.sql.
--
-- Lets each receptionist choose where their live calls land:
--   'CELL' = forward the call to their mobile phone over PSTN (current behavior, the safe default).
--   'WEB'  = ring their browser via Telnyx WebRTC/SIP (zero-latency in-browser calling).
--
-- IMPORTANT: 'WEB' only carries audio once the receptionist's browser is registered to a
-- Telnyx Credential Connection (via the @telnyx/webrtc SDK) using `sip_username`. Until that
-- frontend layer exists, the app safely treats 'WEB' as 'CELL' (falls back to PSTN) so no call
-- is ever dropped. Read defensively in code, so routing keeps working whether or not this ran.

-- 1) Per-receptionist endpoint choice. Default 'CELL' protects every existing receptionist.
ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS routing_endpoint TEXT NOT NULL DEFAULT 'CELL';

-- Constrain to the two valid values (drop first so re-running the script never errors).
ALTER TABLE receptionists
  DROP CONSTRAINT IF EXISTS receptionists_routing_endpoint_check;

ALTER TABLE receptionists
  ADD CONSTRAINT receptionists_routing_endpoint_check
  CHECK (routing_endpoint IN ('WEB', 'CELL'));

-- 2) SIP username the browser registers with on the Telnyx Credential Connection.
--    NULL = not provisioned yet (so 'WEB' has no target and routing falls back to the cell).
ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS sip_username TEXT;

COMMENT ON COLUMN receptionists.routing_endpoint IS
  'Where this receptionist answers live calls: CELL (PSTN forward, default) or WEB (Telnyx WebRTC/SIP in-browser).';
COMMENT ON COLUMN receptionists.sip_username IS
  'Telnyx Credential Connection SIP username the browser registers with; required for WEB routing. NULL = not provisioned.';

-- 3) Denormalized mirror on the hot inbound routing snapshot (phone_numbers.inbound_*),
--    so the voice webhook reads the endpoint without an extra join. Populated by the snapshot
--    writer on every routing save. Nullable so pre-backfill rows simply behave as 'CELL'.
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS inbound_routing_endpoint TEXT;

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS inbound_sip_username TEXT;

COMMENT ON COLUMN phone_numbers.inbound_routing_endpoint IS
  'Snapshot mirror of the selected receptionist''s routing_endpoint (WEB/CELL) for the inbound voice fast path.';
COMMENT ON COLUMN phone_numbers.inbound_sip_username IS
  'Snapshot mirror of the selected receptionist''s sip_username for the inbound voice fast path.';
