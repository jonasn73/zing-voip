-- Telnyx Voice AI assistant id (Mission Control → AI Assistants → copy id).
-- Used by TeXML <Connect><AIAssistant id="..."/></Connect> on no-answer fallback.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telnyx_ai_assistant_id TEXT;
