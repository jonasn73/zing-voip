import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY for voice preview" },
      { status: 400 }
    )
  }

  try {
    const body = await req.json()
    const voiceId = String(body?.voiceId || "").trim()
    const text = String(body?.text || "").trim()
    if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 })
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 })

    const previewRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
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

    if (!previewRes.ok) {
      const errText = await previewRes.text().catch(() => "Voice preview failed")
      return NextResponse.json({ error: errText || "Voice preview failed" }, { status: 500 })
    }

    const audioBuffer = await previewRes.arrayBuffer()
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Voice preview failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
