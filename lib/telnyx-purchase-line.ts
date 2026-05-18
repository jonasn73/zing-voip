// Purchase a Telnyx DID and attach it to the Lyncr TeXML call router.

import { getOrCreateTexmlApp, configureNumberVoice, telnyxHeaders, getTelnyxApiKey } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type PurchaseTelnyxLineResult =
  | { ok: true; phone_number: string; order_id: string }
  | { ok: false; error: string }

/** Buy `phoneNumberE164` on Telnyx and point voice to `/api/voice/telnyx/incoming`. */
export async function purchaseAndConfigureTelnyxLine(phoneNumberE164: string): Promise<PurchaseTelnyxLineResult> {
  const phone_number = phoneNumberE164.trim()
  if (!phone_number) {
    return { ok: false, error: "Phone number is required" }
  }

  try {
    getTelnyxApiKey()
  } catch {
    return { ok: false, error: "Telnyx is not configured on the server (missing TELNYX_API_KEY)." }
  }

  const res = await fetch(`${TELNYX_BASE}/number_orders`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({ phone_numbers: [{ phone_number }] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errMsg =
      (data as { errors?: { detail?: string; title?: string }[] })?.errors?.[0]?.detail ||
      (data as { errors?: { detail?: string; title?: string }[] })?.errors?.[0]?.title ||
      "Telnyx could not purchase this number — it may no longer be available. Search again and pick a different line."
    console.error("[Telnyx] purchase failed:", errMsg, data)
    return { ok: false, error: String(errMsg) }
  }

  const orderId = String((data as { data?: { id?: string } })?.data?.id || "")
  const boughtNumber =
    String(
      (data as { data?: { phone_numbers?: { phone_number?: string }[] } })?.data?.phone_numbers?.[0]?.phone_number ||
        phone_number
    ) || phone_number

  const texmlAppId = await getOrCreateTexmlApp()
  try {
    await configureNumberVoice(boughtNumber, texmlAppId)
  } catch {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      await configureNumberVoice(boughtNumber, texmlAppId)
    } catch (retryErr) {
      console.error("[Telnyx] voice config failed after retry (number still purchased):", retryErr)
    }
  }

  console.log(`[Telnyx] Purchased and configured ${boughtNumber} (order ${orderId})`)
  return { ok: true, phone_number: boughtNumber, order_id: orderId }
}
