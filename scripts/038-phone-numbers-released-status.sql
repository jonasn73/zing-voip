-- Allow marking purchased lines as released (returned to carrier inventory).
-- Run in Neon SQL Editor (see scripts/MIGRATE-ALL.md step 38).

ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_status_check;

ALTER TABLE phone_numbers
  ADD CONSTRAINT phone_numbers_status_check
  CHECK (status IN ('active', 'pending', 'porting', 'released'));

COMMENT ON COLUMN phone_numbers.status IS 'active = live on carrier; porting = transfer in progress; released = returned to carrier; pending = placeholder';
