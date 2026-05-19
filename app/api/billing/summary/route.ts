import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/admin-api-guard"
import {
  BILLING_PLAN_ORDER,
  CREDIT_PACK_CENTS_USD,
  DEFAULT_PAID_PLAN,
  METERED_VOICE_CENTS_PER_MINUTE,
  PLAN_INCLUDED_MINUTES_PER_MONTH,
  PLAN_MONTHLY_PRICE_CENTS,
  TELNYX_NUMBER_PURCHASE_CENTS,
  formatUsdFromCents,
  type BillingPlanKey,
} from "@/lib/billing-pricing"
import { getTelnyxAccountBalance } from "@/lib/telnyx-billing"

export async function GET(req: Request) {
  try {
    const ctx = await requireSessionUser(req)
    if (ctx instanceof NextResponse) return ctx
    const plan = (ctx.user.billing_plan || "trial") as BillingPlanKey
    const safePlan: BillingPlanKey = BILLING_PLAN_ORDER.includes(plan) ? plan : "trial"
    const plans = BILLING_PLAN_ORDER.map((key) => ({
      key,
      monthly_price_cents: PLAN_MONTHLY_PRICE_CENTS[key],
      monthly_price_label: formatUsdFromCents(PLAN_MONTHLY_PRICE_CENTS[key]),
      included_minutes_per_month: PLAN_INCLUDED_MINUTES_PER_MONTH[key],
    }))
    const balanceCents = Number(ctx.user.credit_balance_cents) || 0

    let telnyx_carrier_balance_label: string | null = null
    let telnyx_available_credit_label: string | null = null
    try {
      const telnyx = await getTelnyxAccountBalance()
      telnyx_carrier_balance_label = formatUsdFromCents(Math.round(telnyx.balance_usd * 100))
      telnyx_available_credit_label = formatUsdFromCents(Math.round(telnyx.available_credit_usd * 100))
    } catch {
      telnyx_carrier_balance_label = null
    }

    return NextResponse.json({
      data: {
        current_plan: safePlan,
        default_paid_plan: DEFAULT_PAID_PLAN,
        credit_balance_cents: balanceCents,
        credit_balance_label: formatUsdFromCents(balanceCents),
        telnyx_carrier_balance_label,
        telnyx_available_credit_label,
        telnyx_number_purchase_label: formatUsdFromCents(TELNYX_NUMBER_PURCHASE_CENTS),
        metered_voice_cents_per_minute: METERED_VOICE_CENTS_PER_MINUTE,
        suggested_credit_packs_cents: [...CREDIT_PACK_CENTS_USD],
        plans,
      },
    })
  } catch (e) {
    console.error("[billing/summary]", e)
    return NextResponse.json({ error: "Billing unavailable" }, { status: 500 })
  }
}
