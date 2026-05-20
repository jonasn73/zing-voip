// GET /api/admin/metrics — KPI strip + Neon/Telnyx health (admin@lyncr.app only).

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { getLyncrAdminMetrics, pingNeonDatabase } from "@/lib/db"
import { pingTelnyxApi } from "@/lib/telnyx"
import type { LyncrAdminMetrics } from "@/lib/types"

export async function GET(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  try {
    const [counts, neonOk, telnyxStatus] = await Promise.all([
      getLyncrAdminMetrics(),
      pingNeonDatabase(),
      pingTelnyxApi(),
    ])
    const data: LyncrAdminMetrics = {
      ...counts,
      health: {
        neon: neonOk ? "ok" : "error",
        telnyx: telnyxStatus,
      },
    }
    return NextResponse.json({ data })
  } catch (e) {
    console.error("[lyncr-admin] metrics:", e)
    return NextResponse.json({ error: "Failed to load admin metrics" }, { status: 500 })
  }
}
