-- 072: Platform-admin inbound routing override (per business owner).
-- When set, Telnyx /incoming dials this PSTN number instead of owner/receptionist/pool routing.

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS admin_routing_override_phone TEXT;

COMMENT ON COLUMN onboarding_profiles.admin_routing_override_phone IS
  'Optional E.164 set by platform admin — inbound calls on this owner''s lines dial here first, bypassing standard routing.';
