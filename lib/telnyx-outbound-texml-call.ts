// Place outbound TeXML calls (e.g. audio diagnostics dial-out to the account owner's cell).

import { getAppUrl } from "@/lib/telnyx"
import { getOrCreateTexmlApp, telnyxHeaders } from "@/lib/telnyx-config"
import { getTelnyxTexmlAccountSid } from "@/lib/telnyx-texml-account"

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

  const [accountSid, applicationSid] = await Promise.all([
    getTelnyxTexmlAccountSid(),
    getOrCreateTexmlApp(),
  ])

  const appUrl = getAppUrl()
  const res = await fetch(`${TELNYX_BASE}/texml/Accounts/${encodeURIComponent(accountSid)}/Calls`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      ApplicationSid: applicationSid,
      From: from,
      To: to,
      Url: url,
      UrlMethod: "POST",
      StatusCallback: `${appUrl}/api/voice/telnyx/status`,
      StatusCallbackMethod: "POST",
      Timeout: 45,
    }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    data?: { from?: string; to?: string; status?: string }
    errors?: Array<{ detail?: string; title?: string }>
  }

  if (!res.ok) {
    const msg =
      body?.errors?.[0]?.detail ||
      body?.errors?.[0]?.title ||
      `Telnyx outbound call failed (${res.status})`
    throw new Error(msg)
  }

  return {
    ok: true,
    call_status: String(body?.data?.status ?? "queued"),
    from: String(body?.data?.from ?? from),
    to: String(body?.data?.to ?? to),
  }
}
