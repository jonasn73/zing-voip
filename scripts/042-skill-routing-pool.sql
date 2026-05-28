-- Skill-tagged routing pool for the managed receptionist workforce.
-- Run in Neon SQL Editor after 041-team-invites.sql.

-- Receptionist specialty tags (e.g. automotive, medical, real_estate).
ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN receptionists.skills IS
  'Industry/specialty tags used to match inbound lines (e.g. automotive, general_support, real_estate).';

-- Per-account / per-line routing: when industry_tag is set, dial the platform pool instead of one receptionist id.
ALTER TABLE routing_config
  ADD COLUMN IF NOT EXISTS industry_tag TEXT;

COMMENT ON COLUMN routing_config.industry_tag IS
  'When set, inbound calls route to platform receptionists whose skills array contains this tag.';

-- Per-DID overrides for industry tag and how the pool is dialed.
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS industry_tag TEXT,
  ADD COLUMN IF NOT EXISTS routing_pool_mode TEXT NOT NULL DEFAULT 'sequential';

ALTER TABLE phone_numbers
  DROP CONSTRAINT IF EXISTS phone_numbers_routing_pool_mode_check;

ALTER TABLE phone_numbers
  ADD CONSTRAINT phone_numbers_routing_pool_mode_check
  CHECK (routing_pool_mode IN ('sequential', 'simultaneous'));

COMMENT ON COLUMN phone_numbers.industry_tag IS
  'Per-line industry tag override for skill-pool routing (falls back to routing_config.industry_tag).';
COMMENT ON COLUMN phone_numbers.routing_pool_mode IS
  'Dial matched receptionists sequentially (one at a time) or simultaneously (ring all).';
