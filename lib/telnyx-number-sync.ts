// Reconcile Telnyx-owned DIDs into Neon when carrier purchase succeeded but DB insert did not.

import {
  clearIncomingRoutingCache,
  getPhoneNumberByNumberAndStatus,
  getPhoneNumbers,
  insertPhoneNumber,
  isReasonablePstnDialString,
  normalizePhoneNumberE164,
  syncInboundDialSnapshotForUser,
} from "@/lib/db"
import { getTelnyxApiKey, telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type TelnyxListedNumber = {
  id: string
  phone_number: string
  connection_id: string | null
}

/** List phone numbers on the platform Telnyx account (paginated first page). */
export async function listTelnyxAccountPhoneNumbers(): Promise<TelnyxListedNumber[]> {
  getTelnyxApiKey()
  const res = await fetch(`${TELNYX_BASE}/phone_numbers?page[size]=100`, {
    headers: telnyxHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail =
      (body as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ||
      `Telnyx list numbers failed (HTTP ${res.status})`
    throw new Error(detail)
  }
  const body = (await res.json()) as { data?: Record<string, unknown>[] }
  return (body.data ?? []).map((n) => ({
    id: String(n.id ?? ""),
    phone_number: String(n.phone_number ?? ""),
    connection_id: n.connection_id != null ? String(n.connection_id) : null,
  }))
}

function userOwnsNumberDigit(userNumbers: { number: string }[], e164: string): boolean {
  const key = normalizePhoneNumberE164(e164).replace(/\D/g, "")
  return userNumbers.some((n) => normalizePhoneNumberE164(n.number).replace(/\D/g, "") === key)
}

/**
 * Insert any Telnyx DIDs missing from Neon for this user.
 * Skips numbers already owned by a different Lyncr account.
 */
export async function syncMissingTelnyxNumbersForUser(userId: string): Promise<{ added: string[] }> {
  const telnyxNumbers = await listTelnyxAccountPhoneNumbers()
  const userNumbers = await getPhoneNumbers(userId)
  const added: string[] = []

  for (const tn of telnyxNumbers) {
    const e164 = normalizePhoneNumberE164(tn.phone_number)
    if (!e164 || !isReasonablePstnDialString(e164)) continue
    if (userOwnsNumberDigit(userNumbers, e164)) continue

    const ownedActive = await getPhoneNumberByNumberAndStatus(e164, "active")
    const ownedPorting = await getPhoneNumberByNumberAndStatus(e164, "porting")
    const owned = ownedActive ?? ownedPorting
    if (owned && owned.user_id !== userId) continue

    if (!owned) {
      await insertPhoneNumber({
        user_id: userId,
        number: e164,
        friendly_name: e164,
        label: "Business Line",
        type: "local",
        status: "active",
        provider_number_sid: tn.id,
      })
      added.push(e164)
      userNumbers.push({ number: e164 })
    }
  }

  if (added.length > 0) {
    clearIncomingRoutingCache()
    void syncInboundDialSnapshotForUser(userId).catch(() => {})
    console.log(
      JSON.stringify({
        zing: "telnyx-number-sync",
        userId,
        added,
      })
    )
  }

  return { added }
}
