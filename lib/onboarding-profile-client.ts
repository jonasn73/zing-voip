import type { OnboardingProfile, UpdateOnboardingProfileRequest } from "@/lib/types"
import {
  normalizeCheckoutSubscriptionTier,
  type CheckoutSubscriptionTier,
} from "@/lib/subscription-checkout"

export type OnboardingProfileSnapshot = {
  profile: OnboardingProfile | null
  /** True when the reserved DID has a carrier SID and is active — calls can route. */
  carrierLive: boolean
}

export async function fetchOnboardingProfile(): Promise<OnboardingProfileSnapshot> {
  const res = await fetch(`/api/onboarding/profile?t=${Date.now()}`, {
    credentials: "include",
    cache: "no-store",
  })
  if (res.status === 401) return { profile: null, carrierLive: false }
  const json = (await res.json().catch(() => ({}))) as {
    data?: OnboardingProfile
    carrier_live?: boolean
    error?: string
  }
  if (!res.ok) {
    if (json.error?.includes("025-onboarding-profiles")) return { profile: null, carrierLive: false }
    throw new Error(json.error || "Could not load onboarding profile")
  }
  return {
    profile: json.data ?? null,
    carrierLive: json.carrier_live === true,
  }
}

export async function patchOnboardingProfile(
  updates: UpdateOnboardingProfileRequest
): Promise<OnboardingProfile> {
  const res = await fetch("/api/onboarding/profile", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  const json = (await res.json().catch(() => ({}))) as { data?: OnboardingProfile; error?: string }
  if (!res.ok) throw new Error(json.error || "Could not save onboarding progress")
  if (!json.data) throw new Error("No profile returned")
  return json.data
}

export async function completeOnboardingCheckoutClient(
  opts?: UpdateOnboardingProfileRequest
): Promise<OnboardingProfile> {
  const res = await fetch("/api/onboarding/profile/complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  })
  const json = (await res.json().catch(() => ({}))) as {
    data?: OnboardingProfile
    error?: string
    simulation_mode?: boolean
  }
  if (!res.ok) throw new Error(json.error || "Could not complete checkout")
  if (!json.data) throw new Error("No profile returned")
  return json.data
}

export type OnboardingProvisionMode = {
  simulation_mode: boolean
  notice: string | null
}

export async function fetchOnboardingProvisionMode(): Promise<OnboardingProvisionMode> {
  const res = await fetch("/api/onboarding/provision-mode", { credentials: "include" })
  const json = (await res.json().catch(() => ({}))) as {
    data?: OnboardingProvisionMode
  }
  return (
    json.data ?? {
      simulation_mode: true,
      notice:
        "Development Mode: Number reserved in Neon DB. Live Telnyx webhooks require production API key mapping.",
    }
  )
}

/** Step 1 — reserve chosen DID in Neon (simulation skips live Telnyx). */
export async function reserveOnboardingNumberClient(payload: {
  reserved_number: string
  reserved_number_display: string | null
  reserved_number_method: "buy" | "port"
  port_carrier?: string | null
}): Promise<{ profile: OnboardingProfile; simulation_mode: boolean }> {
  const res = await fetch("/api/onboarding/profile/reserve-number", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json().catch(() => ({}))) as {
    data?: OnboardingProfile
    simulation_mode?: boolean
    error?: string
    reason?: string
    upgrade_message?: string
  }
  if (!res.ok) {
    const msg = json.upgrade_message || json.error || "Could not reserve number"
    throw new Error(msg)
  }
  if (!json.data) throw new Error("No profile returned")
  return { profile: json.data, simulation_mode: json.simulation_mode !== false }
}

export async function startStripeSubscriptionCheckout(
  tier: CheckoutSubscriptionTier | string = "starter"
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const normalizedTier = normalizeCheckoutSubscriptionTier(tier)
  const res = await fetch("/api/billing/stripe/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier: normalizedTier }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    data?: { url?: string; session_id?: string }
    error?: string
  }
  if (!res.ok) throw new Error(json.error || "Could not start Stripe checkout")
  if (!json.data?.url) throw new Error("Stripe checkout URL missing")
  return { checkoutUrl: json.data.url, sessionId: json.data.session_id ?? "" }
}

/** Sync subscription from Stripe after checkout (session id optional — falls back to email lookup). */
export async function confirmStripeSubscriptionAfterCheckout(
  sessionId?: string | null
): Promise<void> {
  const res = await fetch("/api/billing/stripe/confirm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId?.trim() || undefined }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || "Could not sync subscription")
}

/** Buy/provision the reserved DID on Telnyx after subscription is active. */
export async function provisionLineAfterPayment(): Promise<{
  phone_number: string
  substituted: boolean
}> {
  const res = await fetch("/api/billing/stripe/provision-line", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  const json = (await res.json().catch(() => ({}))) as {
    data?: { phone_number?: string; substituted?: boolean }
    error?: string
    reason?: string
    upgrade_message?: string
  }
  if (!res.ok) {
    if (res.status === 403 && json.reason === "tier_limit") {
      const { showUpgradeSubscriptionModal } = await import("@/components/upgrade-subscription-modal")
      showUpgradeSubscriptionModal({ message: json.upgrade_message || json.error })
    }
    throw new Error(json.error || "Could not provision your line")
  }
  if (!json.data?.phone_number) throw new Error("Provision response missing phone number")
  return {
    phone_number: json.data.phone_number,
    substituted: json.data.substituted === true,
  }
}

/** Stripe Checkout for a prepaid carrier credit pack ($10 / $25 / $50 / $100). */
export async function startCreditPackCheckout(amountCents: number): Promise<{ checkoutUrl: string }> {
  const res = await fetch("/api/billing/stripe/credit-checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_cents: amountCents }),
  })
  const json = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string }
  if (!res.ok) throw new Error(json.error || "Could not start credit checkout")
  if (!json.data?.url) throw new Error("Stripe checkout URL missing")
  return { checkoutUrl: json.data.url }
}

/** After credit-pack redirect — apply balance and retry Telnyx line purchase. */
export async function confirmCreditPackCheckout(sessionId: string): Promise<{
  balance_after_cents: number
  telnyx_message: string
  provisioned: boolean
  provision_error: string | null
}> {
  const res = await fetch("/api/billing/stripe/confirm-credit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    data?: {
      balance_after_cents?: number
      telnyx_message?: string
      provisioned?: boolean
      provision_error?: string | null
    }
    error?: string
  }
  if (!res.ok) throw new Error(json.error || "Could not confirm credit purchase")
  return {
    balance_after_cents: json.data?.balance_after_cents ?? 0,
    telnyx_message: json.data?.telnyx_message ?? "",
    provisioned: json.data?.provisioned === true,
    provision_error: json.data?.provision_error ?? null,
  }
}

/** @deprecated Use startStripeSubscriptionCheckout — activation completes via Stripe webhook. */
export async function activateSubscriptionClient(opts?: {
  saveBillingMethod?: boolean
}): Promise<never> {
  void opts
  const { checkoutUrl } = await startStripeSubscriptionCheckout()
  window.location.href = checkoutUrl
  throw new Error("Redirecting to Stripe checkout")
}
