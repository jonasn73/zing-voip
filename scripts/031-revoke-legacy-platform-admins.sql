-- Revoke platform admin from all accounts except admin@lyncr.app.
-- Run in Neon SQL Editor after core migrations (see scripts/MIGRATE-ALL.md step 31).

UPDATE users
SET is_platform_admin = false
WHERE lower(trim(email)) <> lower('admin@lyncr.app');

-- Remove legacy bootstrap operator (admin@getzingapp.com) if it exists.
DELETE FROM users
WHERE lower(trim(email)) = lower('admin@getzingapp.com');
