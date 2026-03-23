// ============================================
// Telnyx Voice AI Assistants — REST (server-only)
// ============================================
// Creates/updates assistants via your platform API key so users never open Mission Control.
// Docs: https://developers.telnyx.com/api-reference/assistants/create-an-assistant

import { telnyxHeaders } from "@/lib/telnyx-config"

/** Telnyx v2 API base (same as number purchase routes). */
const TELNYX_BASE = "https://api.telnyx.com/v2"

/** Default LLM id (override with TELNYX_AI_DEFAULT_MODEL). See GET /v2/ai/models. */
const FALLBACK_MODEL = "openai/gpt-4o-mini"

/** Default Telnyx TTS voice string. Override with TELNYX_AI_VOICE. */
const FALLBACK_VOICE = "Telnyx.KokoroTTS.af_heart"

/** Read model id from env or use a safe default. */
function defaultModel(): string {
  return process.env.TELNYX_AI_DEFAULT_MODEL?.trim() || FALLBACK_MODEL
}

/** Read voice id from env or use Telnyx built-in default. */
function defaultVoice(): string {
  return process.env.TELNYX_AI_VOICE?.trim() || FALLBACK_VOICE
}

/** User override wins; otherwise platform env / built-in default (used on create). */
export function resolveAssistantModel(override?: string | null | undefined): string {
  const t = override?.trim()
  if (t) return t
  return defaultModel()
}

/** User override wins; otherwise platform env / built-in default (used on create). */
export function resolveAssistantVoice(override?: string | null | undefined): string {
  const t = override?.trim()
  if (t) return t
  return defaultVoice()
}

/** Extract first API error string from a Telnyx JSON body. */
function telnyxErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "errors" in body) {
    const errs = (body as { errors?: { detail?: string }[] }).errors
    const d = errs?.[0]?.detail
    if (d) return d
  }
  return JSON.stringify(body).slice(0, 500)
}

export type CreateTelnyxAssistantParams = {
  /** Shown in Telnyx dashboard lists. */
  name: string
  /** System / playbook instructions. */
  instructions: string
  /** First thing the assistant says on connect. */
  greeting: string
  /** Optional — defaults from env or built-in. */
  model?: string
  /** Optional — defaults from env or built-in. */
  voice?: string
}

/**
 * POST /v2/ai/assistants — provision a new Voice AI assistant on your Telnyx account.
 * Returns Telnyx assistant id for TeXML <AIAssistant id="…">.
 */
export async function telnyxCreateAssistant(params: CreateTelnyxAssistantParams): Promise<{ id: string }> {
  const model = params.model || defaultModel()
  const voice = params.voice || defaultVoice()
  const res = await fetch(`${TELNYX_BASE}/ai/assistants`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      name: params.name,
      model,
      instructions: params.instructions,
      greeting: params.greeting,
      voice_settings: { voice },
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
  if (!res.ok) {
    throw new Error(`Telnyx create assistant failed: ${telnyxErrorMessage(body)}`)
  }
  const id = body?.data?.id
  if (!id || typeof id !== "string") {
    throw new Error("Telnyx create assistant succeeded but no data.id returned")
  }
  return { id }
}

export type UpdateTelnyxAssistantParams = {
  instructions?: string
  greeting?: string
  name?: string
  model?: string
  voice_settings?: { voice?: string }
}

/**
 * POST /v2/ai/assistants/{id} — push new instructions/greeting after user edits intake in Zing.
 */
export async function telnyxUpdateAssistant(
  assistantId: string,
  updates: UpdateTelnyxAssistantParams
): Promise<void> {
  const id = encodeURIComponent(assistantId.trim())
  const res = await fetch(`${TELNYX_BASE}/ai/assistants/${id}`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      ...updates,
      promote_to_main: true,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Telnyx update assistant failed: ${telnyxErrorMessage(body)}`)
  }
}

const MAX_TTS_PREVIEW_CHARS = 1200

/**
 * One-shot TTS for “preview opening line” in the dashboard (same Telnyx account as Voice AI).
 * Docs: POST /v2/text-to-speech — voice string matches assistant voice_settings.voice (e.g. Telnyx.KokoroTTS.af_heart).
 */
export async function telnyxSynthesizeSpeechPreview(
  text: string,
  voice: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const clipped = text.trim().slice(0, MAX_TTS_PREVIEW_CHARS)
  if (!clipped) {
    throw new Error("No text to speak")
  }
  const res = await fetch(`${TELNYX_BASE}/text-to-speech`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      text: clipped,
      voice: voice.trim(),
      output_type: "binary_output",
    }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as unknown
    throw new Error(`Telnyx TTS failed: ${telnyxErrorMessage(body)}`)
  }
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get("content-type") || "audio/mpeg"
  return { buffer, contentType }
}
