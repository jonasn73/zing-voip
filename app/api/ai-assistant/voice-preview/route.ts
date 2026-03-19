import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const VAPI_BASE = "https://api.vapi.ai"

function getVapiKey(): string {
  const key = process.env.VAPI_API_KEY
  if (!key) throw new Error("Missing VAPI_API_KEY for voice preview")
  return key
}

async function callVapiPreview(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(`${VAPI_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getVapiKey()}`,
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

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const body = await req.json()
    const voiceId = String(body?.voiceId || "").trim()
    const text = String(body?.text || "").trim()
    if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 })
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 })

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

    for (const attempt of attempts) {
      const previewRes = await callVapiPreview(attempt.endpoint, attempt.payload)
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
          headers: { Authorization: `Bearer ${getVapiKey()}` },
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

    return NextResponse.json(
      { error: "Vapi voice preview endpoint unavailable for this account/voice." },
      { status: 502 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Voice preview failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
