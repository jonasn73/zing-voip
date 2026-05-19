import type { OnboardingProfile } from "@/lib/types"

/**
 * Live UI only when subscription is verified — Stripe sub id on file or Telnyx DID provisioned.
 * Prevents stale `has_active_subscription=true` from mock activations showing LIVE PRODUCTION.
 */
export function isVerifiedActiveSubscription(
  profile: Pick<
    OnboardingProfile,
    "has_active_subscription" | "stripe_subscription_id"
  > | null | undefined,
  carrierLive: boolean
): boolean {
  if (profile?.has_active_subscription !== true) return false
  if (profile.stripe_subscription_id?.trim()) return true
  if (carrierLive) return true
  return false
}

/** True when Stripe Checkout is not needed — customer already has a paid subscription id. */
export function hasPaidStripeSubscription(
  profile: Pick<OnboardingProfile, "stripe_subscription_id"> | null | undefined
): boolean {
  return Boolean(profile?.stripe_subscription_id?.trim())
}

/** User still needs to complete Stripe payment (not sim-only `has_active_subscription`). */
export function needsStripeSubscriptionCheckout(
  profile: Pick<
    OnboardingProfile,
    "has_active_subscription" | "stripe_subscription_id"
  > | null | undefined,
  carrierLive: boolean
): boolean {
  if (carrierLive) return false
  if (hasPaidStripeSubscription(profile)) return false
  return true
}

/** Paid subscription exists but the carrier line is not live yet. */
export function needsLineProvisioning(
  profile: Pick<
    OnboardingProfile,
    "has_active_subscription" | "stripe_subscription_id"
  > | null | undefined,
  carrierLive: boolean
): boolean {
  return isVerifiedActiveSubscription(profile, carrierLive) && !carrierLive
}
