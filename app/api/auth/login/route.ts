// ============================================
// POST /api/auth/login
// ============================================
// Verifies email/password, sets session cookie.

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
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
