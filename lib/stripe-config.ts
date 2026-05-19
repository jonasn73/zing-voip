import Stripe from "stripe"
import { PLAN_MONTHLY_PRICE_CENTS, type BillingPlanKey } from "@/lib/billing-pricing"

/** Fallback amount (cents) when creating inline prices — production uses Stripe Price IDs. */
export const LYNCR_STARTER_PLAN_MONTHLY_CENTS = PLAN_MONTHLY_PRICE_CENTS.starter

/** @deprecated Use LYNCR_STARTER_PLAN_MONTHLY_CENTS */
export const LYNCR_CORE_PLAN_MONTHLY_CENTS = LYNCR_STARTER_PLAN_MONTHLY_CENTS

/** Reads Stripe secret — supports common Vercel typo `KeyValueSTRIPE_SECRET_KEY`. */
function readStripeSecretKeyFromEnv(): string | undefined {
  const candidates = [
    process.env.STRIPE_SECRET_KEY,
    process.env.KeyValueSTRIPE_SECRET_KEY,
  ]
  for (const raw of candidates) {
    const trimmed = raw?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

export function getStripeSecretKey(): string {
  const key = readStripeSecretKeyFromEnv()
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }
  return key
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET")
  }
  return secret
}

export function isStripeConfigured(): boolean {
  return Boolean(readStripeSecretKeyFromEnv())
}

let stripeSingleton: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey(), {
      typescript: true,
    })
  }
  return stripeSingleton
}

/** Production Starter plan price id — set STRIPE_STARTER_PRICE_ID in Vercel ($49/mo). */
export function getStripeStarterPriceId(): string {
  const id =
    process.env.STRIPE_STARTER_PRICE_ID?.trim() ||
    process.env.STRIPE_CORE_PRICE_ID?.trim() ||
    process.env.STRIPE_TEST_PRICE_ID?.trim() ||
    ""
  if (!id) {
    throw new Error(
      "Missing STRIPE_STARTER_PRICE_ID — add your live Starter plan price id (price_…) in Vercel env."
    )
  }
  return id
}

/** @deprecated Use getStripeStarterPriceId */
export function getStripeCorePriceId(): string {
  return getStripeStarterPriceId()
}

/** Turns Starter price env into a Checkout-ready price id (handles prod_… misconfiguration). */
export async function resolveStripeStarterPriceId(stripe: Stripe): Promise<string> {
  const id = getStripeStarterPriceId()
  if (id.startsWith("price_")) {
    return id
  }
  if (id.startsWith("prod_")) {
    const product = await stripe.products.retrieve(id, { expand: ["default_price"] })
    const defaultPrice = product.default_price
    if (typeof defaultPrice === "string") {
      return defaultPrice
    }
    if (defaultPrice && typeof defaultPrice === "object" && "id" in defaultPrice) {
      return defaultPrice.id
    }
    const prices = await stripe.prices.list({
      product: id,
      active: true,
      type: "recurring",
      limit: 1,
    })
    const fallback = prices.data[0]?.id
    if (fallback) {
      return fallback
    }
    throw new Error(
      `STRIPE_STARTER_PRICE_ID is a product (${id}) with no price. In Stripe Dashboard → Products → add a recurring price, then set STRIPE_STARTER_PRICE_ID to the price id (price_…).`
    )
  }
  throw new Error(
    `STRIPE_STARTER_PRICE_ID must start with price_ (not "${id.slice(0, 8)}…"). In Stripe Dashboard open your product and copy the Price id.`
  )
}

/** @deprecated Use resolveStripeStarterPriceId */
export const resolveStripeCorePriceId = resolveStripeStarterPriceId

export function planMonthlyPriceCents(plan: BillingPlanKey): number {
  return PLAN_MONTHLY_PRICE_CENTS[plan] ?? PLAN_MONTHLY_PRICE_CENTS.starter
}
