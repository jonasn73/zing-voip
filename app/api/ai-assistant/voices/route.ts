import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Voice selection for live calls is configured in Telnyx Mission Control (per assistant).
 * This endpoint remains so older clients do not 404.
 */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json({
    voices: [] as { id: string; label: string }[],
    source: "telnyx",
    hint: "Pick voice and model in Telnyx → Voice AI → your Assistant. Zing only stores the Assistant id.",
  })
}
