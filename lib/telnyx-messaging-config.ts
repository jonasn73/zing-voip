// Telnyx messaging profile + assign purchased numbers for outbound SMS lead alerts.

import { getAppUrl } from "@/lib/telnyx"
import { SITE_NAME } from "@/lib/brand"
import { getTelnyxApiKey, telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

const MESSAGING_PROFILE_NAMES = [
  `${SITE_NAME} SMS`,
  "Lyncr SMS",
  "Zing SMS",
  "HeySigo SMS",
] as const

function messagingProfileWebhookUrl(): string {
  return `${getAppUrl().replace(/\/$/, "")}/api/webhooks/telnyx/messaging`
}

/** Optional explicit profile id from Vercel — skips list/create. */
export function getConfiguredMessagingProfileId(): string | null {
  return process.env.TELNYX_MESSAGING_PROFILE_ID?.trim() || null
}

/** Find or create the platform SMS messaging profile. */
export async function getOrCreateMessagingProfile(): Promise<string> {
  const configured = getConfiguredMessagingProfileId()
  if (configured) return configured

  getTelnyxApiKey()

  const listRes = await fetch(`${TELNYX_BASE}/messaging_profiles?page[size]=50`, {
    headers: telnyxHeaders(),
  })
  const listBody = (await listRes.json().catch(() => ({}))) as {
    data?: { id?: string; name?: string }[]
  }
  const profiles = listBody.data ?? []
  const existing = profiles.find((p) =>
    MESSAGING_PROFILE_NAMES.includes(p.name as (typeof MESSAGING_PROFILE_NAMES)[number])
  )
  if (existing?.id) return String(existing.id)
  if (profiles[0]?.id) return String(profiles[0].id)

  const createRes = await fetch(`${TELNYX_BASE}/messaging_profiles`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      name: `${SITE_NAME} SMS`,
      webhook_url: messagingProfileWebhookUrl(),
      webhook_api_version: "2",
      enabled: true,
    }),
  })
  const createBody = (await createRes.json().catch(() => ({}))) as {
    data?: { id?: string }
    errors?: { detail?: string; title?: string }[]
  }
  const profileId = createBody.data?.id
  if (!profileId) {
    const msg =
      createBody.errors?.[0]?.detail ||
      createBody.errors?.[0]?.title ||
      "Could not create Telnyx messaging profile"
    throw new Error(msg)
  }
  console.log(`[Telnyx] Created messaging profile ${profileId}`)
  return String(profileId)
}

/** Assign one E.164 line to the platform messaging profile (idempotent). */
export async function configureNumberMessaging(phoneNumberE164: string): Promise<void> {
  const target = phoneNumberE164.trim()
  if (!target) return

  getTelnyxApiKey()
  const profileId = await getOrCreateMessagingProfile()

  const encoded = encodeURIComponent(target)
  let patchRes = await fetch(`${TELNYX_BASE}/messaging_phone_numbers/${encoded}`, {
    method: "PATCH",
    headers: telnyxHeaders(),
    body: JSON.stringify({ messaging_profile_id: profileId }),
  })

  if (!patchRes.ok && patchRes.status === 404) {
    patchRes = await fetch(`${TELNYX_BASE}/phone_numbers/${encoded}/messaging`, {
      method: "PATCH",
      headers: telnyxHeaders(),
      body: JSON.stringify({ messaging_profile_id: profileId }),
    })
  }

  if (patchRes.ok) {
    console.log(`[Telnyx] Messaging profile ${profileId} assigned to ${target}`)
    return
  }

  const patchBody = (await patchRes.json().catch(() => ({}))) as {
    errors?: { detail?: string; title?: string; code?: string }[]
  }
  const errMsg =
    patchBody.errors?.[0]?.detail ||
    patchBody.errors?.[0]?.title ||
    `HTTP ${patchRes.status}`
  throw new Error(`Could not assign ${target} to messaging profile: ${errMsg}`)
}

/** Assign every purchased Telnyx line we know about (best-effort). */
export async function ensureProviderNumbersMessagingReady(numbers: string[]): Promise<string[]> {
  const warnings: string[] = []
  const unique = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))]
  for (const number of unique) {
    try {
      await configureNumberMessaging(number)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`${number}: ${msg}`)
    }
  }
  return warnings
}
