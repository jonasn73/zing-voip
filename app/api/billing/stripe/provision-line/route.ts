import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getOnboardingProfile } from "@/lib/db"
import { provisionReservedLineAfterStripePayment } from "@/lib/stripe-webhook-sync"
import { isVerifiedActiveSubscription } from "@/lib/onboarding-subscription-status"
import { isReservedLineCarrierLive } from "@/lib/onboarding-line-carrier-status"

/** Retry Telnyx purchase for a paid account whose line is not yet carrier-live. */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    await req.json().catch(() => ({}))
    const profile = await getOnboardingProfile(userId)
    if (!profile?.reserved_number?.trim()) {
      return NextResponse.json({ error: "No reserved business line on file." }, { status: 400 })
    }

    const carrierLive = await isReservedLineCarrierLive(userId, profile.reserved_number)
    if (isVerifiedActiveSubscription(profile, carrierLive) && carrierLive) {
      return NextResponse.json({
        data: { provisioned: true, phone_number: profile.reserved_number, already_live: true },
      })
    }

    if (!profile.stripe_subscription_id?.trim() && !profile.has_active_subscription) {
      return NextResponse.json({ error: "Activate your subscription before provisioning a line." }, { status: 402 })
    }

    const result = await provisionReservedLineAfterStripePayment(userId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json({
      data: {
        provisioned: true,
        phone_number: result.phone_number,
        substituted: result.substituted,
      },
    })
  } catch (e) {
    console.error("[billing/stripe/provision-line POST]", e)
    const msg = e instanceof Error ? e.message : "Could not provision line"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
