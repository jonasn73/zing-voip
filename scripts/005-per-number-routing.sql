-- ============================================
-- Per-number routing: each business number can route to a different receptionist
-- Run this in your Neon SQL Editor after the previous migrations.
-- ============================================

-- Add business_number column to routing_config
-- NULL = default/global config (backwards compatible with existing rows)
-- Non-NULL = config for a specific business number
ALTER TABLE routing_config DROP CONSTRAINT IF EXISTS routing_config_user_id_key;

ALTER TABLE routing_config
  ADD COLUMN IF NOT EXISTS business_number TEXT DEFAULT NULL;

-- Replace the old unique constraint (user_id only) with a new one (user_id + business_number)
-- This allows multiple rows per user (one per business number + one default where business_number IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_routing_config_user_number
  ON routing_config (user_id, COALESCE(business_number, '__default__'));
