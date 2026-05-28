// GET /api/receptionists/payouts — answered calls + earnings for the current billing cycle.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getReceptionistPayoutMetricsForBillingCycle } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const payload = await getReceptionistPayoutMetricsForBillingCycle(userId)
    const total_earnings = payload.agents.reduce((sum, agent) => sum + agent.total_earnings, 0)
    const total_answered_calls = payload.agents.reduce((sum, agent) => sum + agent.answered_calls, 0)
    const total_talk_minutes =
      Math.round(payload.agents.reduce((sum, agent) => sum + agent.total_talk_seconds / 60, 0) * 10) / 10

    return NextResponse.json({
      data: {
        billing_cycle: payload.billing_cycle,
        summary: {
          total_answered_calls,
          total_talk_minutes,
          total_earnings: Math.round(total_earnings * 100) / 100,
        },
        agents: payload.agents,
      },
    })
  } catch (error) {
    console.error("[lyncr] receptionist payouts:", error)
    return NextResponse.json({ error: "Failed to load receptionist payouts" }, { status: 500 })
  }
}
