import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getCallQualitySummary, getVoiceOperationsInsights } from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const daysParam = req.nextUrl.searchParams.get("days")
  const days = Math.max(1, Math.min(90, Number(daysParam || 7) || 7))

  try {
    const [summary, insights] = await Promise.all([
      getCallQualitySummary(userId, days),
      getVoiceOperationsInsights(userId, days),
    ])
    return NextResponse.json({ days, summary, insights })
  } catch (error) {
    console.error("[VoiceQuality] Failed to load summary:", error)
    return NextResponse.json(
      {
        days,
        summary: {
          total_calls: 0,
          answered_calls: 0,
          answer_rate_percent: 0,
          avg_setup_ms: null,
          p95_setup_ms: null,
          avg_post_dial_delay_ms: null,
        },
        insights: {
          daily_quality: [],
          number_quality: [],
          top_missed_callers: [],
        },
        degraded: true,
        warning:
          "Call quality data could not be loaded. Check Vercel logs; ensure Neon has scripts/007-call-quality-metrics.sql if you need setup-time stats.",
      },
      { status: 200 }
    )
  }
}
