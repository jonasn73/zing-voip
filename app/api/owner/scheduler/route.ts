// ============================================
// GET /api/owner/scheduler
// ============================================
// Owner calendar events (BOOKED + PENDING_TIME jobs) for a date range.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listOwnerSchedulerEvents } from "@/lib/db"
import { monthRangeUtc, parseIsoDateParam } from "@/lib/scheduler-utils"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const fromParam = req.nextUrl.searchParams.get("from")
  const toParam = req.nextUrl.searchParams.get("to")
  const monthParam = req.nextUrl.searchParams.get("month")
  const organizationId = req.nextUrl.searchParams.get("organization_id")?.trim() || null

  let fromIso = fromParam
  let toIso = toParam

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number)
    const range = monthRangeUtc(y, m - 1)
    fromIso = range.from
    toIso = range.to
  } else {
    const fromDate = parseIsoDateParam(fromParam)
    const toDate = parseIsoDateParam(toParam)
    if (fromDate) fromIso = fromDate.toISOString()
    if (toDate) toIso = toDate.toISOString()
  }

  if (!fromIso || !toIso) {
    const now = new Date()
    const range = monthRangeUtc(now.getFullYear(), now.getMonth())
    fromIso = range.from
    toIso = range.to
  }

  try {
    const events = await listOwnerSchedulerEvents({
      ownerUserId: userId,
      fromIso,
      toIso,
      organizationId: organizationId && !organizationId.startsWith("legacy-") ? organizationId : null,
    })
    return NextResponse.json({ data: { events, from: fromIso, to: toIso } })
  } catch (e) {
    console.error("[GET /api/owner/scheduler]", e)
    return NextResponse.json({ data: { events: [], from: fromIso, to: toIso }, degraded: true })
  }
}
