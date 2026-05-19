import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getOnboardingProfile, normalizePhoneNumberE164 } from "@/lib/db"
import { evaluateNumberProvisionGate } from "@/lib/number-allocation"
import { provisionReservedLineAfterStripePayment } from "@/lib/stripe-webhook-sync"
import { isVerifiedActiveSubscription } from "@/lib/onboarding-subscription-status"
import { isReservedLineCarrierLive } from "@/lib/onboarding-line-carrier-status"

/** Retry carrier purchase for a paid account whose line is not yet live. */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { phone_number?: string }
    const chosen = body.phone_number?.trim()
      ? normalizePhoneNumberE164(body.phone_number.trim())
      : undefined
    const profile = await getOnboardingProfile(userId)
    if (!profile?.reserved_number?.trim() && !chosen) {
      return NextResponse.json({ error: "No reserved business line on file." }, { status: 400 })
    }

    const checkNumber = chosen || profile!.reserved_number!
    const carrierLive = await isReservedLineCarrierLive(userId, checkNumber)
    if (isVerifiedActiveSubscription(profile, carrierLive) && carrierLive) {
      return NextResponse.json({
        data: { provisioned: true, phone_number: checkNumber, already_live: true },
      })
    }

    if (!profile?.stripe_subscription_id?.trim() && !profile?.has_active_subscription) {
      return NextResponse.json({ error: "Activate your subscription before provisioning a line." }, { status: 402 })
    }

    const gate = await evaluateNumberProvisionGate(userId, checkNumber)
    if (!gate.allowed) {
      const status = gate.reason === "tier_limit" ? 403 : 402
      return NextResponse.json(
        {
          error: gate.message,
          reason: gate.reason,
          upgrade_message: gate.upgrade_message,
          subscription_tier: gate.tier,
        },
        { status }
      )
    }

    const result = await provisionReservedLineAfterStripePayment(userId, {
      phoneNumberE164: chosen,
    })
    if (!result.ok) {
      const status = result.reason === "number_unavailable" ? 409 : 422
      return NextResponse.json(
        {
          error: result.error,
          reason: result.reason,
          unavailable_number: result.unavailable_number,
          area_code: result.area_code,
        },
        { status }
      )
    }

    return NextResponse.json({
      data: {
        provisioned: true,
        phone_number: result.phone_number,
        user_confirmed_number: result.user_confirmed_number,
      },
    })
  } catch (e) {
    console.error("[billing/stripe/provision-line POST]", e)
    const msg = e instanceof Error ? e.message : "Could not provision line"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
