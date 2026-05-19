// Place outbound TeXML calls (e.g. audio diagnostics dial-out to the account owner's cell).

import { getAppUrl } from "@/lib/telnyx"
import { getOrCreateTexmlApp, telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type InitiateTexmlOutboundCallParams = {
  /** Telnyx-owned business DID shown as caller ID. */
  fromE164: string
  /** Destination handset (owner cell). */
  toE164: string
  /** TeXML instruction URL Telnyx fetches when the callee answers. */
  instructionUrl: string
}

export type InitiateTexmlOutboundCallResult = {
  ok: true
  call_status: string
  from: string
  to: string
}

/** Dial `toE164` from `fromE164` and run TeXML from `instructionUrl`. */
export async function initiateTexmlOutboundCall(
  params: InitiateTexmlOutboundCallParams
): Promise<InitiateTexmlOutboundCallResult> {
  const from = params.fromE164.trim()
  const to = params.toE164.trim()
  const url = params.instructionUrl.trim()
  if (!from || !to || !url) {
    throw new Error("Outbound call requires from, to, and instruction URL.")
  }

  const connectionId = await getOrCreateTexmlApp()
  const appUrl = getAppUrl()
  const body = new URLSearchParams({
    To: to,
    From: from,
    Url: url,
    UrlMethod: "POST",
    StatusCallback: `${appUrl}/api/voice/telnyx/status`,
    StatusCallbackMethod: "POST",
    Timeout: "45",
  })

  const res = await fetch(
    `${TELNYX_BASE}/texml/calls/${encodeURIComponent(connectionId)}`,
    {
      method: "POST",
      headers: {
        ...telnyxHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  )

  const raw = await res.json().catch(() => ({}))
  const payload = raw as {
    data?: { from?: string; to?: string; status?: string; call_sid?: string }
    from?: string
    to?: string
    status?: string
    errors?: Array<{ detail?: string; title?: string }>
  }

  if (!res.ok) {
    const msg =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.title ||
      `Telnyx outbound call failed (${res.status})`
    throw new Error(msg)
  }

  const data = payload.data ?? payload
  return {
    ok: true,
    call_status: String(data.status ?? "queued"),
    from: String(data.from ?? from),
    to: String(data.to ?? to),
  }
}
