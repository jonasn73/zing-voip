-- Add Vapi assistant ID to users table
-- Each business gets one Vapi AI assistant that handles their calls
ALTER TABLE users ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT DEFAULT NULL;
