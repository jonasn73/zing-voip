-- ============================================
-- Add port_in_request_sid to phone_numbers
-- Used to link our DB row to Twilio's Port In request (KW...) for status and webhooks.
-- ============================================

ALTER TABLE phone_numbers
ADD COLUMN IF NOT EXISTS port_in_request_sid TEXT DEFAULT '';

COMMENT ON COLUMN phone_numbers.port_in_request_sid IS 'Twilio Port In request SID (KW...) when status=porting; empty when active or bought directly.';
