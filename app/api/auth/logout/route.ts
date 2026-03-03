// ============================================
// POST /api/auth/logout
// ============================================
// Clears the session cookie.

import { NextResponse } from "next/server"
import { getSessionCookieName } from "@/lib/auth"

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } })
  res.cookies.set(getSessionCookieName(), "", { path: "/", maxAge: 0 })
  return res
}
