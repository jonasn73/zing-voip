// ============================================
// GET /api/analytics
// ============================================
// Returns talk time and earnings. Protected: requires session.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getAgentTalkTime } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get("start") || new Date(Date.now() - 7 * 86400000).toISOString()
    const endDate = searchParams.get("end") || new Date().toISOString()

    const agentStats = await getAgentTalkTime(userId, startDate, endDate)

    const totalMinutes = agentStats.reduce((sum, a) => sum + a.total_seconds / 60, 0)
    const totalEarnings = agentStats.reduce(
      (sum, a) => sum + (a.total_seconds / 60) * a.rate_per_minute,
      0
    )
    const totalCalls = agentStats.reduce((sum, a) => sum + a.total_calls, 0)

    return NextResponse.json({
      summary: {
        total_minutes: Math.round(totalMinutes * 10) / 10,
        total_earnings: Math.round(totalEarnings * 100) / 100,
        total_calls: totalCalls,
        avg_call_duration: totalCalls > 0 ? Math.round((totalMinutes / totalCalls) * 60) : 0,
      },
      agents: agentStats.map((a) => ({
        id: a.receptionist_id,
        name: a.receptionist_name,
        total_minutes: Math.round((a.total_seconds / 60) * 10) / 10,
        total_calls: a.total_calls,
        rate_per_minute: a.rate_per_minute,
        total_earnings: Math.round((a.total_seconds / 60) * a.rate_per_minute * 100) / 100,
        daily: a.daily.map((d) => ({
          date: d.date,
          minutes: Math.round((d.seconds / 60) * 10) / 10,
        })),
      })),
      period: { start: startDate, end: endDate },
    })
  } catch (error) {
    console.error("[Zing] Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
