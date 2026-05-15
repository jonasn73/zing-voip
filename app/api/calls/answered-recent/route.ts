// ============================================
// GET /api/calls/answered-recent
// ============================================
// Recent inbound calls that have `answered_at` set — used to prompt “save customer” after pickup.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listRecentlyAnsweredIncomingCalls } from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req.headers.get("cookie"))
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const mins = Number(req.nextUrl.searchParams.get("withinMinutes") || "12")
    const within = Number.isFinite(mins) ? Math.min(Math.max(mins, 1), 60) : 12
    const calls = await listRecentlyAnsweredIncomingCalls(userId, within)
    return NextResponse.json({ calls })
  } catch (e) {
    console.error("[GET /api/calls/answered-recent]", e)
    return NextResponse.json({ error: "Failed to load calls", calls: [] }, { status: 500 })
  }
}
