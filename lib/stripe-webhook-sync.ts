import type Stripe from "stripe"
import { normalizeSubscriptionTier, subscriptionTierFromStripePriceId, type SubscriptionTier } from "@/lib/subscription-tier"
import {
  adjustUserCarrierCredit,
  getOnboardingProfile,
  getPhoneNumbers,
  getUser,
  insertPhoneNumber,
  normalizePhoneNumberE164,
  syncOnboardingLineToPhoneNumbers,
  updateOnboardingProfile,
  updatePhoneNumber,
} from "@/lib/db"
import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import {
  CARRIER_PROVISIONING_FEE_USD,
  hasEnoughCarrierCredit,
} from "@/lib/subscription-tier"
import { purchaseAndConfigureTelnyxLine } from "@/lib/telnyx-purchase-line"
import { evaluateNumberProvisionGate } from "@/lib/number-allocation"

export type ProvisionLineResult =
  | { ok: true; phone_number: string; substituted: boolean }
  | { ok: false; error: string }

/** Read subscription tier from Stripe subscription line items. */
export function resolveSubscriptionTierFromStripeSubscription(
  subscription: Stripe.Subscription
): SubscriptionTier | null {
  for (const item of subscription.items?.data ?? []) {
    const priceRef = item.price
    const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id
    const tier = subscriptionTierFromStripePriceId(priceId)
    if (tier) return tier
  }
  const metaTier = subscription.metadata?.subscription_tier ?? subscription.metadata?.plan
  if (metaTier) {
    return normalizeSubscriptionTier(normalizeCheckoutSubscriptionTier(metaTier))
  }
  return null
}

function stripePeriodToIso(unixSec: number | null | undefined): string | null {
  if (unixSec == null || !Number.isFinite(unixSec)) return null
  return new Date(unixSec * 1000).toISOString()
}

function resolveUserIdFromStripeObject(obj: {
  metadata?: Stripe.Metadata | null
  client_reference_id?: string | null
}): string | null {
  const fromMeta = obj.metadata?.user_id?.trim()
  if (fromMeta) return fromMeta
  const ref = obj.client_reference_id?.trim()
  return ref || null
}

/** Buy reserved DID on Telnyx after Stripe payment — always live, skips simulation gate. */
export async function provisionReservedLineAfterStripePayment(userId: string): Promise<ProvisionLineResult> {
  const profile = await getOnboardingProfile(userId)
  if (!profile?.reserved_number?.trim()) {
    return { ok: false, error: "No reserved business line on file." }
  }

  if (profile.reserved_number_method === "port") {
    await syncOnboardingLineToPhoneNumbers(userId, profile)
    return { ok: true, phone_number: profile.reserved_number, substituted: false }
  }

  const normalized = normalizePhoneNumberE164(profile.reserved_number)
  const existing = await getPhoneNumbers(userId)
  const row = existing.find((r) => normalizePhoneNumberE164(r.number) === normalized)
  if (row?.provider_number_sid?.trim()) {
    return { ok: true, phone_number: row.number, substituted: false }
  }

  const provisionGate = await evaluateNumberProvisionGate(userId, profile.reserved_number)
  if (!provisionGate.allowed) {
    return { ok: false, error: provisionGate.message }
  }

  const user = await getUser(userId)
  const profileCredit = provisionGate.carrier_credit
  const legacyCents = Number(user?.credit_balance_cents ?? 0)
  const carrierCreditUsd = profileCredit > 0 ? profileCredit : legacyCents / 100
  if (!hasEnoughCarrierCredit(carrierCreditUsd)) {
    return {
      ok: false,
      error: `Add at least $${CARRIER_PROVISIONING_FEE_USD.toFixed(2)} carrier credit on the Pay tab before we can purchase your line.`,
    }
  }

  const purchase = await purchaseAndConfigureTelnyxLine(normalized, { allowAreaFallback: true })
  if (!purchase.ok) {
    return { ok: false, error: purchase.error }
  }

  if (purchase.substituted) {
    await updateOnboardingProfile(userId, {
      reserved_number: purchase.phone_number,
      reserved_number_display: formatPhoneDisplay(purchase.phone_number),
    })
  }

  await adjustUserCarrierCredit({
    userId,
    deltaUsd: -CARRIER_PROVISIONING_FEE_USD,
    reason: "carrier_number_purchase",
    reference: purchase.order_id,
    meta: { phone_number: purchase.phone_number },
  })

  const label = user?.business_name?.trim() || "Business Line"
  const friendly =
    (purchase.substituted ? formatPhoneDisplay(purchase.phone_number) : profile.reserved_number_display?.trim()) ||
    purchase.phone_number

  if (row) {
    await updatePhoneNumber(row.id, userId, {
      number: purchase.phone_number,
      friendly_name: friendly,
      provider_number_sid: purchase.order_id,
      status: "active",
    })
  } else {
    await insertPhoneNumber({
      user_id: userId,
      number: purchase.phone_number,
      friendly_name: friendly,
      label,
      type: "local",
      status: "active",
      provider_number_sid: purchase.order_id,
    })
  }

  return { ok: true, phone_number: purchase.phone_number, substituted: purchase.substituted }
}

/** Apply Stripe subscription billing state to Neon and provision Telnyx. */
export async function syncStripeSubscriptionToNeon(
  userId: string,
  subscription: Stripe.Subscription,
  opts?: { customerId?: string | null }
): Promise<void> {
  const periodStart = stripePeriodToIso(subscription.current_period_start)
  const periodEnd = stripePeriodToIso(subscription.current_period_end)
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? opts?.customerId ?? null

  const tier =
    resolveSubscriptionTierFromStripeSubscription(subscription) ??
    (subscription.status === "active" || subscription.status === "trialing" ? "starter" : "free_trial")

  if (tier === "free_trial") {
    return
  }

  await updateOnboardingProfile(userId, {
    has_active_subscription: true,
    subscription_tier: tier,
    billing_cycle_start: periodStart,
    billing_cycle_end: periodEnd,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  })

  const { applySubscriptionTierToUser } = await import("@/lib/stripe-billing-sync")
  await applySubscriptionTierToUser(userId, tier)

  const provision = await provisionReservedLineAfterStripePayment(userId)
  if (!provision.ok) {
    console.error("[stripe] Telnyx provision after payment failed:", provision.error)
  }
}

export async function handleStripeSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const userId = resolveUserIdFromStripeObject(subscription)
  if (!userId) {
    console.error("[stripe] subscription.created missing user_id metadata", subscription.id)
    return
  }
  if (subscription.status === "incomplete" || subscription.status === "incomplete_expired") {
    return
  }
  await syncStripeSubscriptionToNeon(userId, subscription)
}

export async function handleStripeInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subRef = invoice.subscription
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id
  if (!subscriptionId) return

  const { getStripeClient } = await import("@/lib/stripe-config")
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  let userId = resolveUserIdFromStripeObject(invoice)
  if (!userId) userId = resolveUserIdFromStripeObject(subscription)
  if (!userId) {
    console.error("[stripe] invoice.payment_succeeded missing user_id metadata", invoice.id)
    return
  }
  await syncStripeSubscriptionToNeon(userId, subscription, {
    customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
  })
}
