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

async function callElevenLabsPreview(voiceId: string, text: string): Promise<Response> {
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
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    }),
  })
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

    const elevenRes = await callElevenLabsPreview(voiceId, text)
    if (elevenRes.ok) {
      const audioBuffer = await elevenRes.arrayBuffer()
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": elevenRes.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "no-store",
          "X-Preview-Source": "elevenlabs-fallback",
        },
      })
    }

    return NextResponse.json(
      {
        error: !vapiKey && !getElevenLabsKey()
          ? "Missing VAPI_API_KEY and ELEVENLABS_API_KEY for voice preview."
          : !vapiKey
            ? "VAPI_API_KEY missing, and provider fallback failed for this voice."
            : !getElevenLabsKey()
              ? "Vapi preview unavailable for this voice and ELEVENLABS_API_KEY is not set."
              : "Preview unavailable from Vapi and provider fallback for this voice.",
      },
      { status: 502 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Voice preview failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
