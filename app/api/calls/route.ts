// ============================================
// GET /api/calls
// ============================================
// Returns call history for the dashboard and activity pages.
// Supports filtering by type and pagination.

import { NextRequest, NextResponse } from "next/server"
import { getCallLogs } from "@/lib/db"

const DEMO_USER_ID = "demo-user-id"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const type = searchParams.get("type") || undefined // incoming, outgoing, missed, voicemail

    const calls = await getCallLogs(DEMO_USER_ID, { limit, offset, type })

    return NextResponse.json({ calls })
  } catch (error) {
    console.error("[Zing] Error fetching calls:", error)
    return NextResponse.json(
      { error: "Failed to fetch call logs" },
      { status: 500 }
    )
  }
}
