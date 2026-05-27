"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  createSessionCookie,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth"
import {
  createImpersonationAdminCookie,
  getImpersonationAdminCookieOptions,
  IMPERSONATION_ADMIN_COOKIE,
} from "@/lib/admin-impersonation"
import { AdminAuthError, requireLyncrAdminSession } from "@/lib/admin-server-auth"
import { getUser } from "@/lib/db"
import { isLyncrAdminUser } from "@/lib/lyncr-admin"

export type StartImpersonationResult = { ok: false; error: string }

/** Operator-only: swap session to target user and redirect to their dashboard. */
export async function startImpersonation(
  targetUserId: string
): Promise<StartImpersonationResult | void> {
  try {
    const { userId: adminUserId } = await requireLyncrAdminSession()

    const userId = targetUserId.trim()
    if (!userId) {
      return { ok: false, error: "targetUserId is required" }
    }
    if (userId === adminUserId) {
      return { ok: false, error: "Cannot impersonate your own account" }
    }

    const target = await getUser(userId)
    if (!target) {
      return { ok: false, error: "Target user not found" }
    }
    if (isLyncrAdminUser(target)) {
      return { ok: false, error: "Cannot impersonate another operator account" }
    }

    const cookieStore = await cookies()
    cookieStore.set(
      getSessionCookieName(),
      createSessionCookie(userId),
      getSessionCookieOptions()
    )
    cookieStore.set(
      IMPERSONATION_ADMIN_COOKIE,
      createImpersonationAdminCookie(adminUserId),
      getImpersonationAdminCookieOptions()
    )
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message }
    }
    const msg = e instanceof Error ? e.message : "Impersonation failed"
    console.error("[admin-impersonation] startImpersonation:", e)
    return { ok: false, error: msg }
  }

  redirect("/dashboard")
}
