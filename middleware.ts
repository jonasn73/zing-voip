// ============================================
// Edge middleware — fast gate for /dashboard/*
// ============================================
// Only checks that the session cookie exists (shape: payload.signature).
// Real signature + expiry validation stays in /api/auth/session (Node).
// This avoids a full-screen loading spinner and reduces “wrong page then correct page” flashes.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** Must match lib/auth.ts COOKIE_NAME */
const ZING_SESSION = "zing_session"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }
  const raw = request.cookies.get(ZING_SESSION)?.value
  if (!raw || !raw.includes(".")) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
}
