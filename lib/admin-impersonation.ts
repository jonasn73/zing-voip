// Admin impersonation cookies — track operator while session acts as target user.

import {
  createSessionCookieWithTtl,
  getLogoutCookieClearOptions,
  getSessionCookieOptions,
  verifySessionCookie,
} from "@/lib/auth"

/** HTTP-only cookie storing the operator user id while impersonating. */
export const IMPERSONATION_ADMIN_COOKIE = "impersonating_from_admin"

/** Impersonation sessions expire after 4 hours. */
export const IMPERSONATION_MAX_AGE_SEC = 60 * 60 * 4

export function createImpersonationAdminCookie(adminUserId: string): string {
  return createSessionCookieWithTtl(adminUserId, IMPERSONATION_MAX_AGE_SEC)
}

export function verifyImpersonationAdminCookie(cookieValue: string | undefined): string | null {
  return verifySessionCookie(cookieValue)
}

export function getImpersonationAdminCookieOptions() {
  const base = getSessionCookieOptions()
  return {
    ...base,
    maxAge: IMPERSONATION_MAX_AGE_SEC,
    expires: new Date(Date.now() + IMPERSONATION_MAX_AGE_SEC * 1000),
  }
}

export function getImpersonationAdminCookieClearOptions() {
  return getLogoutCookieClearOptions()
}
