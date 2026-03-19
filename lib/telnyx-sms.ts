// ============================================
// Telnyx outbound SMS (lead alerts to owner)
// ============================================
// Env: TELNYX_API_KEY (existing), TELNYX_MESSAGING_FROM_E164 — your Telnyx number enabled for SMS.

/**
 * Send a plain SMS via Telnyx REST API. Returns ok:false if not configured.
 */
export async function sendTelnyxSms(params: {
  toE164: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.TELNYX_API_KEY?.trim()
  const from = process.env.TELNYX_MESSAGING_FROM_E164?.trim()
  if (!apiKey) return { ok: false, error: "TELNYX_API_KEY missing" }
  if (!from) return { ok: false, error: "TELNYX_MESSAGING_FROM_E164 not set" }

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: params.toE164,
      text: params.text,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { ok: false, error: err.slice(0, 200) }
  }
  return { ok: true }
}
