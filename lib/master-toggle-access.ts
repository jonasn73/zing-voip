// Who may see and use the platform-owner quick-toggle profile.

import { isLyncrAdminUser } from "@/lib/lyncr-admin"
import type { User } from "@/lib/types"

/** True for DB platform admins and the operator console email (admin@lyncr.app). */
export function canUseMasterToggleProfile(user: Pick<User, "email" | "is_platform_admin">): boolean {
  if (user.is_platform_admin === true) return true
  return isLyncrAdminUser(user)
}
