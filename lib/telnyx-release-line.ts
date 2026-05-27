// Release (delete) a Telnyx phone number from the carrier account.

import { telnyxHeaders, getTelnyxApiKey } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type ReleaseTelnyxLineResult =
  | { ok: true; telnyx_id: string }
  | { ok: false; error: string; reason?: "not_on_carrier" | "carrier_error" }

/** Look up the Telnyx inventory record for one E.164 DID. */
async function findTelnyxPhoneNumberId(e164: string): Promise<string | null> {
  const res = await fetch(
    `${TELNYX_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}&page[size]=1`,
    { headers: telnyxHeaders() }
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return null
  const id = (body as { data?: { id?: string }[] })?.data?.[0]?.id
  return id ? String(id) : null
}

/** Remove a DID from Telnyx so it stops billing and can be bought again by someone else. */
export async function releaseTelnyxPhoneNumber(e164: string): Promise<ReleaseTelnyxLineResult> {
  try {
    getTelnyxApiKey()
  } catch {
    return { ok: false, error: "Telnyx is not configured on the server.", reason: "carrier_error" }
  }

  const telnyxId = await findTelnyxPhoneNumberId(e164.trim())
  if (!telnyxId) {
    // Already gone on Telnyx — treat as success so we can still mark released in our DB.
    return { ok: true, telnyx_id: "" }
  }

  const res = await fetch(`${TELNYX_BASE}/phone_numbers/${telnyxId}`, {
    method: "DELETE",
    headers: telnyxHeaders(),
  })

  if (res.ok || res.status === 404) {
    return { ok: true, telnyx_id: telnyxId }
  }

  const data = await res.json().catch(() => ({}))
  const errMsg =
    (data as { errors?: { detail?: string; title?: string }[] })?.errors?.[0]?.detail ||
    (data as { errors?: { detail?: string; title?: string }[] })?.errors?.[0]?.title ||
    `Telnyx could not release this number (HTTP ${res.status}).`
  console.error("[Telnyx] release failed:", errMsg, data)
  return { ok: false, error: String(errMsg), reason: "carrier_error" }
}
