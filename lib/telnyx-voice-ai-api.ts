// ============================================
// Telnyx Voice AI Assistants — REST (server-only)
// ============================================
// Creates/updates assistants via your platform API key so users never open Mission Control.
// Docs: https://developers.telnyx.com/api-reference/assistants/create-an-assistant

import { telnyxHeaders } from "@/lib/telnyx-config"

/** Telnyx v2 API base (same as number purchase routes). */
const TELNYX_BASE = "https://api.telnyx.com/v2"

/**
 * Default LLM when `TELNYX_AI_DEFAULT_MODEL` is unset.
 * Telnyx often rejects `openai/gpt-4o-mini` for Voice AI assistants — use a model they allow (see GET /v2/ai/models).
 */
const FALLBACK_MODEL = "openai/gpt-4o"

/** If the primary model is rejected for assistants, try these in order (skip duplicates). */
const ASSISTANT_MODEL_FALLBACKS = ["openai/gpt-4o", "google/gemini-2.5-flash"] as const

/** Models Telnyx rejects for Voice AI assistants — map to a safe id so updates don’t keep failing. */
const ASSISTANT_MODEL_ALIASES: Record<string, string> = {
  "openai/gpt-4o-mini": "openai/gpt-4o",
}

/** Default Telnyx TTS voice string. Override with TELNYX_AI_VOICE. */
const FALLBACK_VOICE = "Telnyx.KokoroTTS.af_heart"

/** Read model id from env or use a safe default (remap legacy blocked ids). */
function defaultModel(): string {
  const raw = process.env.TELNYX_AI_DEFAULT_MODEL?.trim()
  if (!raw) return FALLBACK_MODEL
  return ASSISTANT_MODEL_ALIASES[raw] ?? raw
}

/** Read voice id from env or use Telnyx built-in default. */
function defaultVoice(): string {
  return process.env.TELNYX_AI_VOICE?.trim() || FALLBACK_VOICE
}

/** User override wins; otherwise platform env / built-in default (used on create). */
export function resolveAssistantModel(override?: string | null | undefined): string {
  const t = override?.trim()
  if (t) return ASSISTANT_MODEL_ALIASES[t] ?? t
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

/**
 * POST /v2/ai/assistants success body varies: OpenAPI shows the assistant at the JSON root (`{ id, name, … }`);
 * some responses may still wrap with `{ data: { id } }`.
 */
function extractAssistantIdFromCreateResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const o = body as Record<string, unknown>
  if (typeof o.id === "string" && o.id.trim()) return o.id.trim()
  if (typeof o.assistant_id === "string" && o.assistant_id.trim()) return o.assistant_id.trim()
  const data = o.data
  if (data && typeof data === "object") {
    const inner = data as Record<string, unknown>
    if (typeof inner.id === "string" && inner.id.trim()) return inner.id.trim()
    if (typeof inner.assistant_id === "string" && inner.assistant_id.trim()) return inner.assistant_id.trim()
    const nested = inner.data
    if (nested && typeof nested === "object" && typeof (nested as { id?: unknown }).id === "string") {
      const nid = String((nested as { id: string }).id).trim()
      if (nid) return nid
    }
  }
  return null
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
 * Retries with fallback models when Telnyx says the model is not available for AI assistants.
 */
export async function telnyxCreateAssistant(params: CreateTelnyxAssistantParams): Promise<{ id: string }> {
  const voice = params.voice || defaultVoice()
  const primary = params.model || defaultModel()
  const orderedModels = [primary, ...ASSISTANT_MODEL_FALLBACKS.filter((m) => m !== primary)]

  let lastError: Error | undefined

  for (const model of orderedModels) {
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
    const body = (await res.json().catch(() => ({}))) as unknown
    if (res.ok) {
      const id = extractAssistantIdFromCreateResponse(body)
      if (!id) {
        console.error("[Zing] Telnyx create assistant 200 but unparseable id:", JSON.stringify(body).slice(0, 2500))
        throw new Error(
          "Telnyx create assistant succeeded but the response did not include an assistant id (unexpected JSON shape)."
        )
      }
      if (model !== primary) {
        console.log(`[Zing] Telnyx assistant created with fallback model "${model}" (primary "${primary}" was rejected).`)
      }
      return { id }
    }

    const detail = telnyxErrorMessage(body)
    lastError = new Error(`Telnyx create assistant failed: ${detail}`)
    const modelRejected =
      detail.includes("not available for AI Assistants") ||
      (detail.includes("not available") && detail.toLowerCase().includes("model"))
    if (!modelRejected) {
      throw lastError
    }
    console.warn(`[Zing] Telnyx rejected assistant model "${model}", trying next…`, detail)
  }

  throw lastError ?? new Error("Telnyx create assistant failed")
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
 * One-shot TTS for “preview opening line” in the dashboard.
 * Docs list POST /v2/text-to-speech, but that path often returns HTTP 404 while /v2/text-to-speech/voices works;
 * callers should catch errors and fall back (e.g. browser speechSynthesis).
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
