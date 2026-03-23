// ============================================
// Telnyx — AI models + TTS voices (server-only)
// ============================================
// Used by /api/ai-assistant/* to populate Advanced AI pickers.

import { telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type TelnyxModelOption = { id: string; owned_by?: string }

/** GET /v2/ai/models — LLM ids for Voice AI assistants. */
export async function listTelnyxAiModels(): Promise<TelnyxModelOption[]> {
  const res = await fetch(`${TELNYX_BASE}/ai/models`, { headers: telnyxHeaders() })
  const body = (await res.json().catch(() => ({}))) as { data?: { id?: string; owned_by?: string }[] }
  if (!res.ok || !Array.isArray(body.data)) return []
  return body.data
    .map((m) => ({
      id: typeof m.id === "string" ? m.id : "",
      owned_by: typeof m.owned_by === "string" ? m.owned_by : undefined,
    }))
    .filter((m) => m.id.length > 0)
}

export type TelnyxVoiceOption = { id: string; label: string }

/** GET /v2/text-to-speech/voices — Telnyx-native voices suitable for Voice AI voice_settings.voice */
export async function listTelnyxProviderVoices(): Promise<TelnyxVoiceOption[]> {
  const params = new URLSearchParams({ provider: "telnyx" })
  const res = await fetch(`${TELNYX_BASE}/text-to-speech/voices?${params}`, { headers: telnyxHeaders() })
  const body = (await res.json().catch(() => ({}))) as {
    voices?: { voice_id?: string; name?: string }[]
  }
  if (!res.ok || !Array.isArray(body.voices)) return []
  return body.voices
    .map((v) => {
      const raw = v as { voice_id?: string; id?: string; name?: string }
      const id = String(raw.voice_id || raw.id || "").trim()
      const name = typeof raw.name === "string" ? raw.name.trim() : ""
      return { id, label: name ? `${name} (${id})` : id }
    })
    .filter((v) => v.id.length > 0)
}
