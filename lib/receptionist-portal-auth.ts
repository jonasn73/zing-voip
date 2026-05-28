// Receptionist portal — resolve logged-in user → receptionist row + owner business context.

import { getReceptionistByPortalUserId, getUser } from "@/lib/db"
import type { Receptionist, User } from "@/lib/types"

/** Business-owner vs receptionist portal account. */
export type AccountRole = "owner" | "receptionist"

export type ReceptionistPortalContext = {
  portal_user: User
  receptionist: Receptionist
  owner_user_id: string
  business_name: string
}

/** True when the user row is tagged as a receptionist portal account. */
export function isReceptionistPortalUser(user: Pick<User, "account_role">): boolean {
  return user.account_role === "receptionist"
}

/**
 * Load receptionist portal context for the signed-in user.
 * Requires a receptionists.portal_user_id link (and account_role receptionist when column exists).
 */
export async function getReceptionistPortalContext(
  portalUserId: string
): Promise<ReceptionistPortalContext | null> {
  const portal_user = await getUser(portalUserId)
  if (!portal_user) return null

  const linked = await getReceptionistByPortalUserId(portalUserId)
  if (!linked) return null

  if (portal_user.account_role !== "receptionist") {
    return null
  }

  const owner = await getUser(linked.user_id)
  const business_name = owner?.business_name?.trim() || "Business line"

  return {
    portal_user,
    receptionist: linked,
    owner_user_id: linked.user_id,
    business_name,
  }
}
