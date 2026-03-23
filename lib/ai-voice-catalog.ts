// ============================================
// Legacy — voice catalog
// ============================================
// Live AI voice is configured in Telnyx Mission Control per assistant.
// Kept for type compatibility if we add Telnyx TTS voice presets later.

export type AiVoiceOption = { id: string; label: string }

export const AI_VOICE_FALLBACK_OPTIONS: AiVoiceOption[] = []

export const AI_VOICE_PREFERRED_ORDER: string[] = []

export function buildVoiceLabelFromApi(v: { name?: string; labels?: Record<string, string> }): string {
  return (v.name || "Voice").trim()
}

export function buildCuratedVoiceListFromApi(
  _apiVoices: { voice_id: string; name?: string; labels?: Record<string, string> }[]
): AiVoiceOption[] {
  return []
}
