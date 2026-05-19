import { getAppUrl } from "@/lib/telnyx"
import { getOnboardingProfile, getUser } from "@/lib/db"
import { DEFAULT_PAID_PLAN, formatUsdFromCents } from "@/lib/billing-pricing"
import type { BillingPlanKey } from "@/lib/billing-pricing"
import { getStripeClient, resolveStripeStarterPriceId } from "@/lib/stripe-config"

export type StripeCheckoutSessionResult = {
  url: string
  sessionId: string
}

/** Creates Stripe Checkout for the Starter subscription (default $49/mo). */
export async function createLyncrSubscriptionCheckout(
  userId: string,
  plan: BillingPlanKey = DEFAULT_PAID_PLAN
): Promise<StripeCheckoutSessionResult> {
  const profile = await getOnboardingProfile(userId)
  if (!profile?.reserved_number?.trim()) {
    throw new Error("Reserve a business line before activating.")
  }
  if (profile.has_active_subscription) {
    throw new Error("Your subscription is already active.")
  }

  const user = await getUser(userId)
  const appUrl = getAppUrl().replace(/\/$/, "")
  const stripe = getStripeClient()
  const priceId = await resolveStripeStarterPriceId(stripe)
  const display =
    profile.reserved_number_display?.trim() || profile.reserved_number?.trim() || "Business line"

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user?.email?.trim() || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        user_id: userId,
        reserved_number: profile.reserved_number,
        plan,
      },
    },
    metadata: {
      checkout_type: "subscription",
      user_id: userId,
      reserved_number: profile.reserved_number,
      line_display: display,
      plan,
    },
    success_url: `${appUrl}/dashboard?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard?stripe_checkout=cancelled`,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.")
  }

  return { url: session.url, sessionId: session.id }
}

/** @deprecated Use createLyncrSubscriptionCheckout */
export const createLyncrCoreSubscriptionCheckout = createLyncrSubscriptionCheckout

/** One-time Stripe Checkout for prepaid carrier credit (syncs to Telnyx wallet after payment). */
export async function createLyncrCreditPackCheckout(
  userId: string,
  creditCents: number
): Promise<StripeCheckoutSessionResult> {
  if (!Number.isFinite(creditCents) || creditCents < 500) {
    throw new Error("Minimum carrier credit purchase is $5.00.")
  }

  const user = await getUser(userId)
  const appUrl = getAppUrl().replace(/\/$/, "")
  const stripe = getStripeClient()
  const label = formatUsdFromCents(creditCents)

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user?.email?.trim() || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: creditCents,
          product_data: {
            name: `Lyncr carrier credit — ${label}`,
            description: "Prepaid balance for phone numbers and call usage on Telnyx.",
          },
        },
      },
    ],
    metadata: {
      checkout_type: "credit_pack",
      user_id: userId,
      credit_cents: String(Math.trunc(creditCents)),
    },
    success_url: `${appUrl}/dashboard/pay?credit_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/pay?credit_checkout=cancelled`,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.")
  }

  return { url: session.url, sessionId: session.id }
}
