import { isPhoneNumberCarrierLive } from "@/lib/phone-carrier-live"
import { getPhoneNumbers, normalizePhoneNumberE164 } from "@/lib/db"

export { isPhoneNumberCarrierLive } from "@/lib/phone-carrier-live"

/** Whether the onboarding reserved DID is provisioned on the carrier (not Neon-only). */
export async function isReservedLineCarrierLive(
  userId: string,
  reservedE164: string | null | undefined
): Promise<boolean> {
  if (!reservedE164?.trim()) return false
  const normalized = normalizePhoneNumberE164(reservedE164)
  if (!normalized.replace(/\D/g, "").length) return false
  const numbers = await getPhoneNumbers(userId)
  const row = numbers.find((r) => normalizePhoneNumberE164(r.number) === normalized)
  if (!row) return false
  return isPhoneNumberCarrierLive(row)
}

/** True when any business line on the account is carrier-live (used for dashboard status). */
export async function isAnyLineCarrierLive(userId: string): Promise<boolean> {
  const numbers = await getPhoneNumbers(userId)
  return numbers.some((row) => isPhoneNumberCarrierLive(row))
}
