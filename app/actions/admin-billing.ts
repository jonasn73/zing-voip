"use server"

import { revalidatePath } from "next/cache"
import { adminAdjustProfileCarrierCredit, getUser } from "@/lib/db"
import { AdminAuthError, requireLyncrAdminSession } from "@/lib/admin-server-auth"

export type AdjustUserCreditResult =
  | { ok: true; carrier_credit_after: number; user_id: string }
  | { ok: false; error: string }

/** Operator-only: atomically adjust onboarding_profiles.carrier_credit for a user. */
export async function adjustUserCredit(
  targetUserId: string,
  amount: number
): Promise<AdjustUserCreditResult> {
  try {
    await requireLyncrAdminSession()

    const userId = targetUserId.trim()
    if (!userId) {
      return { ok: false, error: "targetUserId is required" }
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return { ok: false, error: "amount must be a non-zero number" }
    }

    const target = await getUser(userId)
    if (!target) {
      return { ok: false, error: "Target user not found" }
    }

    const result = await adminAdjustProfileCarrierCredit({ userId, amountUsd: amount })
    revalidatePath("/admin")
    return {
      ok: true,
      user_id: result.user_id,
      carrier_credit_after: result.carrier_credit_after,
    }
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message }
    }
    const msg = e instanceof Error ? e.message : "Credit adjustment failed"
    console.error("[admin-billing] adjustUserCredit:", e)
    return { ok: false, error: msg }
  }
}
