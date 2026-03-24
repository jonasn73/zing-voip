-- Ring owner's cell before Voice AI when AI fallback is on and no receptionist (dashboard toggle).
-- Run in Neon after 014.

ALTER TABLE routing_config
ADD COLUMN IF NOT EXISTS ai_ring_owner_first BOOLEAN NOT NULL DEFAULT false;
