// ============================================
// GET /api/calls/live
// ============================================
// Recent inbound legs that have not received a terminal status yet (`ended_at` null).
// The Leads page polls this so owners can see activity on the line without opening Activity.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listLiveCallLogsForUser } from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req.headers.get("cookie"))
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const calls = await listLiveCallLogsForUser(userId)
    return NextResponse.json({ calls })
  } catch (e) {
    console.error("[GET /api/calls/live]", e)
    return NextResponse.json({ error: "Failed to load live calls", calls: [] }, { status: 500 })
  }
}
