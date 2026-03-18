// ============================================
// GET /api/numbers/mine
// ============================================
// Returns the authenticated user's business phone numbers from the database.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getPhoneNumbers } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const numbers = await getPhoneNumbers(userId)
    return NextResponse.json({ numbers })
  } catch (error) {
    console.error("[Zing] Error fetching user numbers:", error)
    return NextResponse.json({ error: "Failed to load numbers" }, { status: 500 })
  }
}
