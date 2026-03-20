// ============================================
// GET /api/ai-leads
// ============================================
// Lists AI-captured leads (Vapi submit_zing_lead) for the signed-in user.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listAiLeadsForUser } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const lim = Number(req.nextUrl.searchParams.get("limit") || "50")
  try {
    const leads = await listAiLeadsForUser(userId, Number.isFinite(lim) ? lim : 50)
    return NextResponse.json({ leads })
  } catch (e) {
    console.error("[GET /api/ai-leads] failed:", e)
    return NextResponse.json({
      leads: [],
      degraded: true,
      warning: "Could not load leads. Check server logs and Neon migration scripts/010-ai-leads-intake.sql.",
    })
  }
}
