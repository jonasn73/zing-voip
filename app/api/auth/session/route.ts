// ============================================
// GET /api/auth/session
// ============================================
// Returns the current user from the session cookie, or 401.
// Refreshes the session cookie (sliding expiration) so you stay logged in while using the app.

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  verifySessionCookie,
  createSessionCookie,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth"
import { getUser } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get("zing_session")?.value
    const userId = verifySessionCookie(cookieValue)
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    // Refresh cookie so session stays valid while you use the app (sliding expiration)
    const newCookieValue = createSessionCookie(userId)
    const opts = getSessionCookieOptions()

    // Dev bypass: no DB call for dev-user (used when database is not connected)
    if (process.env.NODE_ENV === "development" && userId === "dev-user") {
      const devEmail = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase() ?? "dev@zing.local"
      const res = NextResponse.json({
        data: {
          user: {
            id: "dev-user",
            email: devEmail,
            name: "Dev User",
            phone: "+15551234567",
            business_name: "My Business",
            created_at: new Date().toISOString(),
          },
        },
      })
      res.cookies.set(getSessionCookieName(), newCookieValue, opts)
      return res
    }
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }
    const res = NextResponse.json({ data: { user } })
    res.cookies.set(getSessionCookieName(), newCookieValue, opts)
    return res
  } catch (error) {
    console.error("[Zing] Session error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
