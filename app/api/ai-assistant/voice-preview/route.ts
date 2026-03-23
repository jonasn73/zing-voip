// ============================================
// POST /api/ai-assistant/voice-preview
// ============================================
// Returns MP3 (or provider default audio) so the browser can play how the opening line sounds in Telnyx TTS.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getTelnyxApiKey } from "@/lib/telnyx-config"
import { resolveAssistantVoice, telnyxSynthesizeSpeechPreview } from "@/lib/telnyx-voice-ai-api"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { text?: string; voice?: string }
  try {
    body = (await req.json()) as { text?: string; voice?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text) {
    return NextResponse.json(
      { error: "Add an opening line (or use the default) before previewing." },
      { status: 400 }
    )
  }

  try {
    getTelnyxApiKey()
  } catch {
    return NextResponse.json(
      { error: "TELNYX_API_KEY is not set on the server (Vercel → Environment Variables)." },
      { status: 503 }
    )
  }

  const voice = resolveAssistantVoice(typeof body.voice === "string" ? body.voice : undefined)

  try {
    const { buffer, contentType } = await telnyxSynthesizeSpeechPreview(text, voice)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS preview failed"
    console.error("[POST /api/ai-assistant/voice-preview]", e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
