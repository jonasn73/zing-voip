-- AI conversation state per call (for Gather-based AI assistant).
-- Run after 002-add-password-hash.sql
CREATE TABLE IF NOT EXISTS ai_conversation_state (
  call_sid TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_conversation_state_user ON ai_conversation_state(user_id);
