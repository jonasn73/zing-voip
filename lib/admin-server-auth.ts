// Server-side admin guard for Server Actions and route handlers.

import { cookies } from "next/headers"
import { getSessionCookieName, verifySessionCookie } from "@/lib/auth"
import { getUser } from "@/lib/db"
import { isLyncrAdminUser } from "@/lib/lyncr-admin"
import type { User } from "@/lib/types"

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminAuthError"
  }
}

/** Requires admin@lyncr.app (operator) session — used before admin mutations. */
export async function requireLyncrAdminSession(): Promise<{ userId: string; user: User }> {
  const cookieStore = await cookies()
  const userId = verifySessionCookie(cookieStore.get(getSessionCookieName())?.value)
  if (!userId) {
    throw new AdminAuthError("Not authenticated")
  }
  const user = await getUser(userId)
  if (!user) {
    throw new AdminAuthError("User not found")
  }
  if (!isLyncrAdminUser(user)) {
    throw new AdminAuthError("Forbidden")
  }
  return { userId, user }
}
