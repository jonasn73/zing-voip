// POST /api/admin/toggle-subscription — flip has_active_subscription (admin only).

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { adminToggleUserSubscription, getOnboardingProfile } from "@/lib/db"

export async function POST(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  try {
    const body = await req.json()
    const userId = String(body?.user_id ?? "").trim()
    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }
    const profile = await getOnboardingProfile(userId)
    const current = profile?.has_active_subscription ?? false
    const nextActive =
      typeof body?.has_active_subscription === "boolean" ? body.has_active_subscription : !current
    const result = await adminToggleUserSubscription(userId, nextActive)
    return NextResponse.json({ data: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Subscription toggle failed"
    console.error("[lyncr-admin] toggle-subscription:", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
