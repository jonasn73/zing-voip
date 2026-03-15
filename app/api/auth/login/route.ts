// ============================================
// POST /api/auth/login
// ============================================
// Verifies email/password, sets session cookie.

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getAuthUserByEmail } from "@/lib/db"
import {
  createSessionCookie,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body?.email ?? "").trim().toLowerCase()
    const password = String(body?.password ?? "")

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Optional: dev login when database is not connected (set DEV_LOGIN_EMAIL + DEV_LOGIN_PASSWORD in .env.local)
    const devEmail = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase()
    const devPassword = process.env.DEV_LOGIN_PASSWORD
    if (process.env.NODE_ENV === "development" && devEmail && devPassword && email === devEmail && password === devPassword) {
      const devUser = {
        id: "dev-user",
        email: devEmail,
        name: "Dev User",
        phone: "+15551234567",
        business_name: "My Business",
        created_at: new Date().toISOString(),
      }
      const cookieValue = createSessionCookie(devUser.id)
      const res = NextResponse.json({ data: { user: devUser } })
      res.cookies.set(getSessionCookieName(), cookieValue, getSessionCookieOptions())
      return res
    }

    const authUser = await getAuthUserByEmail(email)
    if (!authUser) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, authUser.password_hash)
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const { password_hash: _, ...user } = authUser
    const cookieValue = createSessionCookie(user.id)
    const res = NextResponse.json({ data: { user } })
    res.cookies.set(getSessionCookieName(), cookieValue, getSessionCookieOptions())
    return res
  } catch (error) {
    console.error("[Zing] Login error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
