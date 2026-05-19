-- Subscription tier + prepaid carrier credit on onboarding_profiles (app "profiles" row per user).
-- Run in Neon after 027-stripe-billing-cycle.sql.

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free_trial',
  ADD COLUMN IF NOT EXISTS carrier_credit NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE onboarding_profiles DROP CONSTRAINT IF EXISTS onboarding_profiles_subscription_tier_check;
ALTER TABLE onboarding_profiles ADD CONSTRAINT onboarding_profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free_trial', 'starter', 'professional', 'business'));

COMMENT ON COLUMN onboarding_profiles.subscription_tier IS 'Entitlements: free_trial | starter (1 line) | professional (3) | business (unlimited).';
COMMENT ON COLUMN onboarding_profiles.carrier_credit IS 'Prepaid USD balance for number provisioning and carrier usage.';

-- Backfill tier from legacy subscription flag.
UPDATE onboarding_profiles
SET subscription_tier = CASE
  WHEN has_active_subscription = true AND subscription_tier = 'free_trial' THEN 'starter'
  ELSE subscription_tier
END;

-- Backfill carrier_credit from users.credit_balance_cents when still zero.
UPDATE onboarding_profiles op
SET carrier_credit = ROUND(u.credit_balance_cents::numeric / 100.0, 2)
FROM users u
WHERE u.id = op.user_id
  AND op.carrier_credit = 0
  AND COALESCE(u.credit_balance_cents, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_subscription_tier
  ON onboarding_profiles(subscription_tier);
