-- 074: Owner job scheduler — structured appointment times on ai_leads.
-- Run in Neon SQL Editor after 073-scoped-admin-routing-override.sql.
--
-- scheduled_at     : when the job is booked on the owner calendar
-- organization_id  : optional workspace scope (NULL = visible in all workspaces)

ALTER TABLE ai_leads
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_leads_scheduled_at_idx
  ON ai_leads (user_id, scheduled_at DESC NULLS LAST)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_leads_org_scheduled_idx
  ON ai_leads (organization_id, scheduled_at DESC NULLS LAST)
  WHERE organization_id IS NOT NULL;

COMMENT ON COLUMN ai_leads.scheduled_at IS 'Owner calendar appointment time; NULL falls back to created_at in scheduler UI.';
COMMENT ON COLUMN ai_leads.organization_id IS 'Workspace scope for multi-business owners; NULL shows in all workspaces.';
