// GET /api/service-context — tier capabilities for the signed-in owner (UI + client guards).

import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedServiceContext } from "@/app/api/middleware/auth-check"
import { TIER_DISPLAY_NAME } from "@/lib/subscription-tier"
import { hasPaidStripeSubscription } from "@/lib/onboarding-subscription-status"
import { getOnboardingProfile } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const resolved = await resolveAuthenticatedServiceContext(req)
  if (resolved instanceof NextResponse) return resolved

  const { session, service } = resolved
  if (session.user.account_role !== "owner") {
    return NextResponse.json({ error: "Only business owners can read service context" }, { status: 403 })
  }

  const profile = await getOnboardingProfile(session.userId)

  return NextResponse.json({
    data: {
      master_test_bypass: service.master_test_bypass,
      subscription_tier: service.subscription_tier,
      subscription_tier_label: TIER_DISPLAY_NAME[service.subscription_tier],
      subscription_active: hasPaidStripeSubscription(profile),
      active_number_limit: service.active_number_limit,
      capabilities: service.capabilities,
    },
  })
}
