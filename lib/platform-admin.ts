// ============================================
// Platform admin access (operator console)
// ============================================
// Only admin@lyncr.app may access /admin (see lib/lyncr-admin.ts).

import type { User } from "./types"
import { isLyncrAdminUser } from "./lyncr-admin"

/** @deprecated Use isLyncrAdminUser — kept for imports that still reference this name. */
export function getPlatformAdminEmailAllowlist(): Set<string> {
  return new Set(["admin@lyncr.app"])
}

/** True when this signed-in user may call admin APIs and open `/admin`. */
export function isPlatformAdminUser(user: Pick<User, "email" | "is_platform_admin">): boolean {
  return isLyncrAdminUser(user)
}
