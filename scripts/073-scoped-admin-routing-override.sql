-- 073: Scope platform-admin inbound routing override to a phone line or workspace — not the whole owner account.
-- Line override (phone_numbers) wins over workspace override (organizations).
-- onboarding_profiles.admin_routing_override_phone (072) is deprecated after this migration.

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS admin_routing_override_phone TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS admin_routing_override_phone TEXT;

COMMENT ON COLUMN phone_numbers.admin_routing_override_phone IS
  'Optional E.164 — inbound calls on this DID dial here first, bypassing standard routing for this line only.';

COMMENT ON COLUMN organizations.admin_routing_override_phone IS
  'Optional E.164 — inbound calls on lines in this workspace dial here when the line has no line-level override.';

-- Move legacy global override onto the reserved-number line only (one row per owner).
UPDATE phone_numbers pn
SET admin_routing_override_phone = trim(op.admin_routing_override_phone)
FROM onboarding_profiles op
WHERE pn.user_id = op.user_id
  AND op.admin_routing_override_phone IS NOT NULL
  AND trim(op.admin_routing_override_phone) <> ''
  AND op.reserved_number IS NOT NULL
  AND trim(op.reserved_number) <> ''
  AND pn.number = op.reserved_number
  AND pn.status IN ('active', 'porting', 'pending');

-- Clear deprecated global column so it cannot leak across workspaces.
UPDATE onboarding_profiles
SET admin_routing_override_phone = NULL
WHERE admin_routing_override_phone IS NOT NULL;
