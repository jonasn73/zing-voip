import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { activateOnboardingSubscription } from "@/lib/onboarding-activate-subscription"
import { isReservedLineCarrierLive } from "@/lib/onboarding-line-carrier-status"
import { isOnboardingTelnyxSimulationMode } from "@/lib/onboarding-telnyx-provision-mode"

/** Mock Stripe checkout — sets has_active_subscription and starts Telnyx provision. */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    await req.json().catch(() => ({}))
    const profile = await activateOnboardingSubscription(userId)
    const display =
      profile.reserved_number_display?.trim() || profile.reserved_number?.trim() || "your line"
    const carrier_live = await isReservedLineCarrierLive(userId, profile.reserved_number)
    const simulation = isOnboardingTelnyxSimulationMode()
    const message = carrier_live
      ? `Live production enabled for ${display}. Inbound calls will route to your configured phones.`
      : simulation
        ? `Payment saved for ${display}. Your line stays in sandbox until Telnyx carrier provisioning completes.`
        : `Provisioning started for ${display}. Live routing will begin once Telnyx confirms the number.`
    return NextResponse.json({
      data: profile,
      carrier_live,
      simulation_mode: simulation,
      message,
    })
  } catch (e) {
    console.error("[onboarding/profile/activate POST]", e)
    const msg = e instanceof Error ? e.message : "Activation failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
