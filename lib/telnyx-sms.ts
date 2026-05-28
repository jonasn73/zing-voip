// Telnyx outbound SMS (lead alerts to owner).

import { getProviderLinkedActiveNumber, normalizePhoneNumberE164 } from "@/lib/db"
import {
  configureNumberMessaging,
  ensureMessagingProfileWhitelisted,
  getOrCreateMessagingProfile,
  isTelnyxOwnedNumber,
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
      return `SMS sender ${fromE164 ?? "unknown"} is not on your Telnyx messaging profile — click Repair SMS on the admin sandbox`
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

function isMissingWhitelistError(raw: string): boolean {
  return raw.toLowerCase().includes("whitelisted destinations")
}

/**
 * Resolve outbound SMS sender — Neon purchased line wins over Vercel env
 * (avoids typos like +15025758186 vs +15025758166).
 */
export async function resolveTelnyxMessagingFromE164(userId?: string): Promise<string | null> {
  const dbFrom =
    (await getProviderLinkedActiveNumber(userId)) ?? (await getProviderLinkedActiveNumber())

  if (dbFrom) {
    const envFrom = process.env.TELNYX_MESSAGING_FROM_E164?.trim()
    if (envFrom && normalizePhoneNumberE164(envFrom) !== normalizePhoneNumberE164(dbFrom)) {
      console.warn(
        `[Telnyx SMS] Ignoring TELNYX_MESSAGING_FROM_E164=${envFrom} — using purchased line ${dbFrom}`
      )
    }
    return dbFrom
  }

  const envFrom = process.env.TELNYX_MESSAGING_FROM_E164?.trim()
  if (envFrom && (await isTelnyxOwnedNumber(envFrom))) return envFrom
  return null
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
  let from =
    params.fromE164?.trim() || (await resolveTelnyxMessagingFromE164(params.userId))
  if (!apiKey) return { ok: false, error: "TELNYX_API_KEY missing" }
  if (!from) {
    return {
      ok: false,
      error:
        "No Telnyx SMS sender — buy a Telnyx number with SMS or fix TELNYX_MESSAGING_FROM_E164 in Vercel",
    }
  }

  if (!(await isTelnyxOwnedNumber(from))) {
    const fallback = await resolveTelnyxMessagingFromE164(params.userId)
    if (fallback && fallback !== from) from = fallback
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
    await configureNumberMessaging(from)
  } catch (e) {
    console.error("[Telnyx SMS] pre-send messaging setup:", e)
  }

  let res = await sendOnce(messagingProfileId)
  if (!res.ok) {
    let errText = await res.text().catch(() => res.statusText)
    if (isMissingWhitelistError(errText) && messagingProfileId) {
      try {
        await ensureMessagingProfileWhitelisted(messagingProfileId)
        res = await sendOnce(messagingProfileId)
        if (res.ok) return { ok: true }
        errText = await res.text().catch(() => res.statusText)
      } catch (whitelistErr) {
        const msg = whitelistErr instanceof Error ? whitelistErr.message : String(whitelistErr)
        return { ok: false, error: msg }
      }
    }
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
        const repairMsg = repairErr instanceof Error ? repairErr.message : String(repairErr)
        return {
          ok: false,
          error: `${formatTelnyxSmsError(errText, from)} (${repairMsg})`,
        }
      }
    }
    return { ok: false, error: formatTelnyxSmsError(errText, from) }
  }

  return { ok: true }
}
