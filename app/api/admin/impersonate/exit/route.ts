// POST /api/admin/impersonate/exit — restore operator session after impersonation.

import { NextRequest, NextResponse } from "next/server"
import {
  createSessionCookie,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth"
import {
  getImpersonationAdminCookieClearOptions,
  IMPERSONATION_ADMIN_COOKIE,
  verifyImpersonationAdminCookie,
} from "@/lib/admin-impersonation"
import { getUser } from "@/lib/db"
import { isLyncrAdminUser } from "@/lib/lyncr-admin"

export async function POST(req: NextRequest) {
  try {
    const match = req.headers.get("cookie")?.match(new RegExp(`${IMPERSONATION_ADMIN_COOKIE}=([^;]+)`))
    const adminUserId = verifyImpersonationAdminCookie(match?.[1]?.trim())
    if (!adminUserId) {
      return NextResponse.json({ error: "Not impersonating" }, { status: 400 })
    }

    const admin = await getUser(adminUserId)
    if (!admin || !isLyncrAdminUser(admin)) {
      return NextResponse.json({ error: "Invalid impersonation session" }, { status: 403 })
    }

    const res = NextResponse.json({ data: { redirect: "/admin" } })
    res.cookies.set(getSessionCookieName(), createSessionCookie(adminUserId), getSessionCookieOptions())
    res.cookies.set(IMPERSONATION_ADMIN_COOKIE, "", getImpersonationAdminCookieClearOptions())
    return res
  } catch (e) {
    console.error("[lyncr-admin] impersonate exit:", e)
    return NextResponse.json({ error: "Failed to exit impersonation" }, { status: 500 })
  }
}
