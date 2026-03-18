// ============================================
// Telnyx Configuration Helpers
// ============================================
// Shared functions for setting up TeXML apps, outbound voice profiles,
// and configuring phone numbers. Used by buy, configure, and porting routes.

const TELNYX_BASE = "https://api.telnyx.com/v2"

export function getTelnyxApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

export function telnyxHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getTelnyxApiKey()}`,
    "Content-Type": "application/json",
  }
}

export function getZingAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.getzingapp.com"
}

// Find or create an outbound voice profile so the TeXML app can place outbound calls
async function getOrCreateOutboundVoiceProfile(): Promise<string> {
  // List existing profiles
  const listRes = await fetch(`${TELNYX_BASE}/outbound_voice_profiles?page[size]=50`, {
    headers: telnyxHeaders(),
  })
  const listBody = await listRes.json()
  const profiles = listBody?.data || []

  // Look for one we already created
  const existing = profiles.find((p: Record<string, unknown>) => p.name === "Zing Outbound")
  if (existing?.id) {
    return String(existing.id)
  }

  // Use any existing profile if available
  if (profiles.length > 0 && profiles[0]?.id) {
    return String(profiles[0].id)
  }

  // Create a new one
  const createRes = await fetch(`${TELNYX_BASE}/outbound_voice_profiles`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      name: "Zing Outbound",
      traffic_type: "conversational",
      whitelisted_destinations: ["US", "CA"],
    }),
  })
  const createBody = await createRes.json()
  const profileId = createBody?.data?.id
  if (!profileId) {
    console.error("[Zing] Failed to create outbound voice profile:", createBody)
    throw new Error("Failed to create outbound voice profile")
  }
  console.log(`[Zing] Created outbound voice profile: ${profileId}`)
  return String(profileId)
}

// Find or create the Zing Call Router TeXML application with outbound calling enabled
export async function getOrCreateTexmlApp(): Promise<string> {
  const appUrl = getZingAppUrl()

  // Check if we already have a Zing TeXML app
  const listRes = await fetch(`${TELNYX_BASE}/texml_applications?page[size]=50`, {
    headers: telnyxHeaders(),
  })
  const listBody = await listRes.json()
  const apps = listBody?.data || []
  const existing = apps.find((a: Record<string, string>) => a.friendly_name === "Zing Call Router")

  if (existing?.id) {
    // Make sure it has an outbound voice profile assigned
    // The field is nested under outbound.outbound_voice_profile_id in the API
    const currentProfileId = existing.outbound?.outbound_voice_profile_id
    if (!currentProfileId) {
      try {
        const profileId = await getOrCreateOutboundVoiceProfile()
        const patchRes = await fetch(`${TELNYX_BASE}/texml_applications/${existing.id}`, {
          method: "PATCH",
          headers: telnyxHeaders(),
          body: JSON.stringify({
            outbound: { outbound_voice_profile_id: profileId },
          }),
        })
        const patchBody = await patchRes.json().catch(() => ({}))
        if (patchRes.ok) {
          console.log(`[Zing] Assigned outbound voice profile ${profileId} to TeXML app ${existing.id}`)
        } else {
          console.error(`[Zing] Failed to PATCH outbound profile:`, patchBody)
        }
      } catch (err) {
        console.error("[Zing] Failed to assign outbound voice profile:", err)
      }
    }
    return String(existing.id)
  }

  // Get outbound voice profile first
  const profileId = await getOrCreateOutboundVoiceProfile()

  // Create the TeXML app with the outbound profile
  const createRes = await fetch(`${TELNYX_BASE}/texml_applications`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      friendly_name: "Zing Call Router",
      voice_url: `${appUrl}/api/voice/telnyx/incoming`,
      voice_method: "POST",
      voice_fallback_url: `${appUrl}/api/voice/telnyx/incoming`,
      status_callback_url: `${appUrl}/api/voice/telnyx/status`,
      status_callback_method: "POST",
      outbound: { outbound_voice_profile_id: profileId },
    }),
  })
  const createBody = await createRes.json()
  if (!createRes.ok) {
    const errMsg = createBody?.errors?.[0]?.detail || JSON.stringify(createBody)
    throw new Error(`Failed to create TeXML app: ${errMsg}`)
  }
  const appId = createBody?.data?.id
  if (!appId) throw new Error("TeXML app created but no ID returned")
  console.log(`[Zing] Created TeXML application ${appId} with outbound profile ${profileId}`)
  return String(appId)
}

// Assign a phone number to our TeXML application so incoming calls route to our webhook
export async function configureNumberVoice(phoneNumber: string, texmlAppId: string): Promise<void> {
  const searchRes = await fetch(
    `${TELNYX_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}&page[size]=1`,
    { headers: telnyxHeaders() }
  )
  const searchBody = await searchRes.json()
  const numberRecord = searchBody?.data?.[0]
  if (!numberRecord?.id) {
    console.error(`[Zing] Could not find Telnyx record for ${phoneNumber}`)
    return
  }

  const patchRes = await fetch(`${TELNYX_BASE}/phone_numbers/${numberRecord.id}/voice`, {
    method: "PATCH",
    headers: telnyxHeaders(),
    body: JSON.stringify({ connection_id: texmlAppId, tech_prefix_enabled: false }),
  })
  if (!patchRes.ok) {
    const patchBody = await patchRes.json().catch(() => ({}))
    console.error(`[Zing] Failed to configure voice for ${phoneNumber}:`, patchBody)
  } else {
    console.log(`[Zing] Voice configured for ${phoneNumber} → TeXML app ${texmlAppId}`)
  }
}
