-- 078: Scope field technician roster rows to a workspace (multi-business owners).
-- Run in Neon SQL Editor after 077-porting-notifications-organization.sql.

ALTER TABLE field_technicians
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS field_technicians_org_idx
  ON field_technicians (user_id, organization_id, is_active);

COMMENT ON COLUMN field_technicians.organization_id IS 'Workspace this technician belongs to (Key Squad vs Fresh Auto, etc.).';

-- Attach existing roster rows to each owner's default organization.
UPDATE field_technicians ft
SET organization_id = org.id
FROM organizations org
WHERE org.owner_user_id = ft.user_id
  AND org.is_default = true
  AND ft.organization_id IS NULL;
