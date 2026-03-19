import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getCallQualitySummary } from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const daysParam = req.nextUrl.searchParams.get("days")
  const days = Math.max(1, Math.min(90, Number(daysParam || 7) || 7))

  try {
    const summary = await getCallQualitySummary(userId, days)
    return NextResponse.json({ days, summary })
  } catch (error) {
    console.error("[VoiceQuality] Failed to load summary:", error)
    return NextResponse.json({ error: "Failed to load call quality summary" }, { status: 500 })
  }
}
