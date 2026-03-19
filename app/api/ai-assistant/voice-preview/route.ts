import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const VAPI_BASE = "https://api.vapi.ai"

function getVapiKey(): string | null {
  const key = process.env.VAPI_API_KEY
  return key?.trim() ? key.trim() : null
}

async function callVapiPreview(
  apiKey: string,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(`${VAPI_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "audio/mpeg, application/json",
    },
    body: JSON.stringify(payload),
  })
}

function asAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${VAPI_BASE}${url}`
  return `${VAPI_BASE}/${url}`
}

function getElevenLabsKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY
  return key?.trim() ? key.trim() : null
}

/** Current ElevenLabs models only — v1 models are deprecated and blocked on free tier (see ElevenLabs notice). */
const ELEVENLABS_PREVIEW_MODELS = [
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
] as const

async function callElevenLabsPreviewOnce(
  voiceId: string,
  text: string,
  modelId: string
): Promise<Response> {
  const key = getElevenLabsKey()
  if (!key) return new Response(null, { status: 400 })
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": key,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    }),
  })
}

/** Try several models; return first OK response or last error body for diagnostics. */
async function callElevenLabsPreviewBestEffort(
  voiceId: string,
  text: string
): Promise<{ ok: true; res: Response } | { ok: false; status: number; detail: string }> {
  if (!getElevenLabsKey()) {
    return { ok: false, status: 400, detail: "ELEVENLABS_API_KEY not set." }
  }
  let lastDetail = ""
  let lastStatus = 502
  for (const modelId of ELEVENLABS_PREVIEW_MODELS) {
    const res = await callElevenLabsPreviewOnce(voiceId, text, modelId)
    if (res.ok) return { ok: true, res }
    lastStatus = res.status
    const errText = await res.text().catch(() => "")
    try {
      const j = JSON.parse(errText) as { detail?: unknown; message?: string }
      if (typeof j?.detail === "string") lastDetail = j.detail
      else if (j?.detail && typeof (j.detail as { message?: string }).message === "string")
        lastDetail = (j.detail as { message: string }).message
      else lastDetail = j?.message || errText.slice(0, 200)
    } catch {
      lastDetail = errText.slice(0, 200) || `HTTP ${res.status}`
    }
  }
  return { ok: false, status: lastStatus, detail: lastDetail }
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const body = await req.json()
    const voiceId = String(body?.voiceId || "").trim()
    const text = String(body?.text || "").trim()
    if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 })
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 })
    const vapiKey = getVapiKey()

    const attempts: Array<{ endpoint: string; payload: Record<string, unknown> }> = [
      { endpoint: `/voice/${encodeURIComponent(voiceId)}/generateSample`, payload: { text } },
      { endpoint: `/voice/${encodeURIComponent(voiceId)}/generate-sample`, payload: { text } },
      { endpoint: `/voice/${encodeURIComponent(voiceId)}/test`, payload: { text } },
      {
        endpoint: "/voice/test",
        payload: {
          text,
          voice: {
            provider: "11labs",
            voiceId,
          },
        },
      },
    ]

    if (vapiKey) {
      for (const attempt of attempts) {
        const previewRes = await callVapiPreview(vapiKey, attempt.endpoint, attempt.payload)
        if (!previewRes.ok) continue

        const contentType = previewRes.headers.get("content-type") || ""
        if (contentType.includes("audio/")) {
          const audioBuffer = await previewRes.arrayBuffer()
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-store",
            },
          })
        }

        const data = await previewRes.json().catch(() => null)
        const audioUrl = data?.url || data?.audioUrl || data?.audio_file_url || data?.file?.url
        const audioBase64 = data?.audio || data?.audioBase64 || data?.base64

        if (typeof audioUrl === "string" && audioUrl.trim()) {
          const audioFetch = await fetch(asAbsoluteUrl(audioUrl.trim()), {
            headers: { Authorization: `Bearer ${vapiKey}` },
          })
          if (audioFetch.ok) {
            const audioBuffer = await audioFetch.arrayBuffer()
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": audioFetch.headers.get("content-type") || "audio/mpeg",
                "Cache-Control": "no-store",
              },
            })
          }
        }

        if (typeof audioBase64 === "string" && audioBase64.trim()) {
          const audioBuffer = Buffer.from(audioBase64, "base64")
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          })
        }
      }
    }

    const elevenResult = await callElevenLabsPreviewBestEffort(voiceId, text)
    if (elevenResult.ok) {
      const elevenRes = elevenResult.res
      const audioBuffer = await elevenRes.arrayBuffer()
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": elevenRes.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "no-store",
          "X-Preview-Source": "elevenlabs-fallback",
        },
      })
    }

    const is404ish = elevenResult.status === 404 || /voice not found|invalid voice/i.test(elevenResult.detail)
    const hint = is404ish
      ? "This ID may be from another provider (not ElevenLabs). Use a preset from the list, paste an ElevenLabs voice ID from your ElevenLabs account, or save and test with a real call."
      : elevenResult.detail || "Try another voice or save and test on a call."

    return NextResponse.json(
      {
        error: !vapiKey && !getElevenLabsKey()
          ? "Missing VAPI_API_KEY and ELEVENLABS_API_KEY for voice preview."
          : !vapiKey
            ? `VAPI_API_KEY missing. ElevenLabs fallback failed: ${hint}`
            : !getElevenLabsKey()
              ? "Vapi preview unavailable for this voice and ELEVENLABS_API_KEY is not set."
              : `Preview unavailable for this voice. ${hint}`,
      },
      { status: 502 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Voice preview failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
