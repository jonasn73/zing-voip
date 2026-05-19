// Legacy helper — TeXML outbound now uses POST /v2/texml/calls/{connection_id} (no account SID).
// Kept for optional override via TELNYX_TEXML_ACCOUNT_SID if an older integration needs it.

import { telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

let cachedAccountSid: string | null = null

/** Optional legacy account SID — not required for /v2/texml/calls/{connection_id}. */
export async function getTelnyxTexmlAccountSid(): Promise<string | null> {
  const fromEnv = process.env.TELNYX_TEXML_ACCOUNT_SID?.trim()
  if (fromEnv) return fromEnv
  if (cachedAccountSid) return cachedAccountSid

  const listRes = await fetch(`${TELNYX_BASE}/texml_applications?page[size]=10`, {
    headers: telnyxHeaders(),
  })
  const listBody = (await listRes.json().catch(() => ({}))) as {
    data?: Array<Record<string, unknown>>
  }
  if (!listRes.ok) return null

  for (const app of listBody.data ?? []) {
    const sid =
      (typeof app.account_sid === "string" && app.account_sid.trim()) ||
      (typeof app.account_id === "string" && app.account_id.trim()) ||
      ""
    if (sid) {
      cachedAccountSid = sid
      return sid
    }
  }

  return null
}
