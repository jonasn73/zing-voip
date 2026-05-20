// POST /api/admin/adjust-credit — atomically adjust onboarding_profiles.carrier_credit (admin only).

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { adjustUserCarrierCredit } from "@/lib/db"

export async function POST(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  try {
    const body = await req.json()
    const userId = String(body?.user_id ?? "").trim()
    const deltaUsd = Number(body?.delta_usd ?? body?.amount_usd ?? body?.delta)
    const reason = String(body?.reason ?? "Admin carrier credit adjustment").trim()
    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }
    if (!Number.isFinite(deltaUsd) || deltaUsd === 0) {
      return NextResponse.json({ error: "delta_usd must be a non-zero number" }, { status: 400 })
    }
    const result = await adjustUserCarrierCredit({
      userId,
      deltaUsd,
      reason: reason.length >= 3 ? reason : "Admin carrier credit adjustment",
      actorUserId: ctx.userId,
      reference: "admin-adjust-credit",
      meta: { source: "lyncr-admin-dashboard" },
    })
    return NextResponse.json({ data: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Credit adjustment failed"
    console.error("[lyncr-admin] adjust-credit:", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
