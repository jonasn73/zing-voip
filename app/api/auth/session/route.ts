// ============================================
// GET /api/auth/session
// ============================================
// Returns the current user from the session cookie, or 401.

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySessionCookie } from "@/lib/auth"
import { getUser } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get("zing_session")?.value
    const userId = verifySessionCookie(cookieValue)
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }
    return NextResponse.json({ data: { user } })
  } catch (error) {
    console.error("[Zing] Session error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
