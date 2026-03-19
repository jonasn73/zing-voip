-- AI fallback intake config per user + leads captured from Vapi tool calls
-- Run in Neon SQL Editor after prior migrations.

CREATE TABLE IF NOT EXISTS user_ai_intake (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caller_e164 TEXT,
  intent_slug TEXT,
  collected JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  sms_sent BOOLEAN NOT NULL DEFAULT false,
  sms_error TEXT,
  vapi_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_leads_user_created_idx ON ai_leads (user_id, created_at DESC);
