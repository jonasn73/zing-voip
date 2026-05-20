-- Admin console metrics + account controls on onboarding_profiles (scripts/MIGRATE-ALL.md step 34).
-- Safe to re-run: uses IF NOT EXISTS / COALESCE backfill.

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS total_calls_routed integer NOT NULL DEFAULT 0;

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS total_minutes_used numeric(10, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS custom_routing_note text;

-- Backfill usage counters from historical call_logs.
UPDATE onboarding_profiles op
SET
  total_calls_routed = COALESCE(sub.call_count, 0),
  total_minutes_used = COALESCE(sub.minutes_used, 0.00),
  updated_at = now()
FROM (
  SELECT
    user_id,
    count(*)::int AS call_count,
    round(coalesce(sum(duration_seconds), 0)::numeric / 60.0, 2) AS minutes_used
  FROM call_logs
  GROUP BY user_id
) sub
WHERE op.user_id = sub.user_id;
