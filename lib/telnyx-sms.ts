// Telnyx outbound SMS (lead alerts to owner).

import { getProviderLinkedActiveNumber } from "@/lib/db"
import {
  configureNumberMessaging,
  getOrCreateMessagingProfile,
} from "@/lib/telnyx-messaging-config"

type TelnyxErrorBody = {
  errors?: { code?: string; title?: string; detail?: string }[]
}

function formatTelnyxSmsError(raw: string, fromE164: string | null): string {
  try {
    const parsed = JSON.parse(raw) as TelnyxErrorBody
    const err = parsed.errors?.[0]
    if (!err) return raw.slice(0, 240)
    if (err.code === "40305") {
      return `SMS sender ${fromE164 ?? "unknown"} is not on your Telnyx messaging profile — click Repair SMS on the admin sandbox or assign the number in Telnyx Mission Control`
    }
    if (err.title && err.detail) return `${err.title}: ${err.detail}`
    if (err.detail) return err.detail
    if (err.title) return err.title
  } catch {
    // Not JSON — return trimmed text.
  }
  return raw.slice(0, 240)
}

function isInvalidFromAddressError(raw: string): boolean {
  return raw.includes("40305") || raw.toLowerCase().includes("invalid 'from' address")
}

/** Resolve the E.164 sender for outbound SMS (env override → account line → any platform line). */
export async function resolveTelnyxMessagingFromE164(userId?: string): Promise<string | null> {
  const envFrom = process.env.TELNYX_MESSAGING_FROM_E164?.trim()
  if (envFrom) return envFrom
  return getProviderLinkedActiveNumber(userId)
}

/**
 * Send a plain SMS via Telnyx REST API.
 * Auto-assigns the sender to the messaging profile when Telnyx returns 40305.
 */
export async function sendTelnyxSms(params: {
  toE164: string
  text: string
  userId?: string
  fromE164?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.TELNYX_API_KEY?.trim()
  const from =
    params.fromE164?.trim() || (await resolveTelnyxMessagingFromE164(params.userId))
  if (!apiKey) return { ok: false, error: "TELNYX_API_KEY missing" }
  if (!from) {
    return {
      ok: false,
      error:
        "No Telnyx SMS sender — set TELNYX_MESSAGING_FROM_E164 in Vercel or buy a Telnyx number with SMS enabled",
    }
  }

  const sendOnce = async (messagingProfileId: string | null) => {
    const body: Record<string, string> = {
      from,
      to: params.toE164,
      text: params.text,
    }
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId

    return fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
  }

  let messagingProfileId: string | null = null
  try {
    messagingProfileId = await getOrCreateMessagingProfile()
  } catch (e) {
    console.error("[Telnyx SMS] messaging profile:", e)
  }

  let res = await sendOnce(messagingProfileId)
  if (!res.ok) {
    let errText = await res.text().catch(() => res.statusText)
    if (isInvalidFromAddressError(errText)) {
      try {
        await configureNumberMessaging(from)
        if (!messagingProfileId) {
          messagingProfileId = await getOrCreateMessagingProfile()
        }
        res = await sendOnce(messagingProfileId)
        if (res.ok) return { ok: true }
        errText = await res.text().catch(() => res.statusText)
      } catch (repairErr) {
        console.error("[Telnyx SMS] auto-repair failed:", repairErr)
      }
    }
    return { ok: false, error: formatTelnyxSmsError(errText, from) }
  }

  return { ok: true }
}
