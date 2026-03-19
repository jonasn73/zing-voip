// ============================================
// Zing — AI receptionist voice catalog (shared)
// ============================================
// Fallback ElevenLabs premade voice IDs used when the platform cannot
// fetch /v1/voices (missing key, outage). Live UI prefers GET /api/ai-assistant/voices.

/** One selectable voice in Settings (id = ElevenLabs voice_id for Vapi provider 11labs). */
export type AiVoiceOption = { id: string; label: string }

/**
 * Curated default list — receptionist-oriented labels; IDs are ElevenLabs premades.
 * Order = preferred “hero” order when merging with API results.
 */
export const AI_VOICE_FALLBACK_OPTIONS: AiVoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — Warm & professional (US)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte — Polished front-desk (US)" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — Warm, human-like (UK)" },
  { id: "SAz9YHcvj6GT2YYXdXww", label: "River — Soft, natural (US)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — Clear & trustworthy (US)" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice — Bright & approachable (UK)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — Smooth narrator tone (UK)" },
  { id: "LcfcDJNUP1GQjkzn1xUU", label: "Emily — Expressive & friendly (US)" },
  { id: "cgSgspJ2msm6clMCldW9", label: "Jessica — Upbeat reception (US)" },
  { id: "jsCqWAovK2LkecY72zG8", label: "Freya — Calm & reassuring (US)" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — Friendly & light (US)" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi — Confident & direct (US)" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — Conversational male (US)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh — Balanced male (US)" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger — Easygoing male (US)" },
  { id: "GBv7mTt0atIp3Br8iCZE", label: "Thomas — Steady & calm male (US)" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie — Natural male (AU)" },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum — Transatlantic, clear male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — Documentary-warm male (UK)" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold — Crisp & articulate male (US)" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni — Calm male (US)" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — Deep male (US)" },
  { id: "2EiwWnXFnvU5JabPnv8n", label: "Clyde — Rich, grounded male (US)" },
]

/** Preferred order of voice_ids when merging API premades with our curated list. */
export const AI_VOICE_PREFERRED_ORDER: string[] = AI_VOICE_FALLBACK_OPTIONS.map((v) => v.id)

/**
 * Build label from ElevenLabs voice name + accent/gender hints when present.
 */
export function buildVoiceLabelFromApi(v: {
  name?: string
  labels?: Record<string, string>
}): string {
  const name = (v.name || "Voice").trim()
  const accent = v.labels?.accent || v.labels?.language || ""
  const gender = v.labels?.gender || ""
  const bits = [accent, gender].filter(Boolean).join(" · ")
  return bits ? `${name} — ${bits}` : name
}

/**
 * Curated list only — same IDs users can expect to preview on typical plans.
 * We do NOT append other ElevenLabs premades (many are “library” voices and fail API preview on free tier).
 */
export function buildCuratedVoiceListFromApi(
  apiVoices: { voice_id: string; name?: string; labels?: Record<string, string> }[]
): AiVoiceOption[] {
  const byId = new Map<string, AiVoiceOption>()
  const fallbackLabel = new Map(AI_VOICE_FALLBACK_OPTIONS.map((x) => [x.id, x.label]))

  for (const row of apiVoices) {
    const id = String(row.voice_id || "").trim()
    if (!id) continue
    const label = fallbackLabel.get(id) || buildVoiceLabelFromApi(row)
    byId.set(id, { id, label })
  }

  const out: AiVoiceOption[] = []
  for (const id of AI_VOICE_PREFERRED_ORDER) {
    const fromApi = byId.get(id)
    const fallback = fallbackLabel.get(id)
    if (fallback) {
      out.push(fromApi ?? { id, label: fallback })
    }
  }
  return out.length > 0 ? out : [...AI_VOICE_FALLBACK_OPTIONS]
}
