// Resolve Telnyx TeXML account SID for outbound REST calls (/texml/Accounts/{account_sid}/Calls).

import { telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

let cachedAccountSid: string | null = null

/** Prefer env, then cache, then read from the first TeXML application in the account. */
export async function getTelnyxTexmlAccountSid(): Promise<string> {
  const fromEnv = process.env.TELNYX_TEXML_ACCOUNT_SID?.trim()
  if (fromEnv) return fromEnv
  if (cachedAccountSid) return cachedAccountSid

  const listRes = await fetch(`${TELNYX_BASE}/texml_applications?page[size]=10`, {
    headers: telnyxHeaders(),
  })
  const listBody = (await listRes.json().catch(() => ({}))) as {
    data?: Array<Record<string, unknown>>
  }
  if (!listRes.ok) {
    throw new Error("Could not list Telnyx TeXML applications.")
  }

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

  throw new Error(
    "Missing Telnyx TeXML account SID. Set TELNYX_TEXML_ACCOUNT_SID in Vercel or confirm TeXML apps exist in Telnyx Mission Control."
  )
}
