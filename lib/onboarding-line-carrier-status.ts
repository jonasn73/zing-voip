import { getPhoneNumbers, normalizePhoneNumberE164 } from "@/lib/db"
import type { PhoneNumber } from "@/lib/types"

/** True when Telnyx (or Twilio) owns the DID and the line is active — calls can route. */
export function isPhoneNumberCarrierLive(row: Pick<PhoneNumber, "provider_number_sid" | "status">): boolean {
  return Boolean(row.provider_number_sid?.trim()) && row.status === "active"
}

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
