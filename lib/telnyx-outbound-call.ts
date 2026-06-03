// ============================================
// Telnyx TeXML outbound call (wrap-up callback)
// ============================================
// Places an outbound call that fetches TeXML from `url`. Used to ring a mobile operator back after a
// job for the hands-free voice wrap-up. Requires a TeXML Application connection id
// (TELNYX_TEXML_CONNECTION_ID) — returns { skipped: true } and logs when unconfigured, so the rest
// of the app keeps working (the SMS outcome prompt remains the always-on fallback).
//
// Docs: POST https://api.telnyx.com/v2/texml/calls/{connection_id}  body: To, From, Url, StatusCallback

export type TexmlOutboundResult =
  | { ok: true; callSid: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string }

function texmlConnectionId(): string | null {
  return (
    process.env.TELNYX_TEXML_CONNECTION_ID?.trim() ||
    process.env.TELNYX_TEXML_APP_ID?.trim() ||
    null
  )
}

export function isTexmlOutboundConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY?.trim() && texmlConnectionId())
}

export async function placeTexmlOutboundCall(params: {
  toE164: string
  fromE164: string
  url: string
  statusCallback?: string
}): Promise<TexmlOutboundResult> {
  const apiKey = process.env.TELNYX_API_KEY?.trim()
  const connectionId = texmlConnectionId()
  if (!apiKey) return { ok: false, skipped: true, reason: "TELNYX_API_KEY missing" }
  if (!connectionId) return { ok: false, skipped: true, reason: "TELNYX_TEXML_CONNECTION_ID missing" }

  const form = new URLSearchParams()
  form.set("To", params.toE164)
  form.set("From", params.fromE164)
  form.set("Url", params.url)
  if (params.statusCallback) form.set("StatusCallback", params.statusCallback)

  try {
    const res = await fetch(`https://api.telnyx.com/v2/texml/calls/${encodeURIComponent(connectionId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      return { ok: false, skipped: false, error: `Telnyx ${res.status}: ${text.slice(0, 240)}` }
    }
    const json = (await res.json().catch(() => ({}))) as { data?: { call_sid?: string; sid?: string } }
    return { ok: true, callSid: json.data?.call_sid ?? json.data?.sid ?? null }
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) }
  }
}
