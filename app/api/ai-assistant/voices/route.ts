import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import {
  AI_VOICE_FALLBACK_OPTIONS,
  mergePremadeVoices,
} from "@/lib/ai-voice-catalog"

/** Do not cache at CDN — voice list is per-deployment and may change. */
export const dynamic = "force-dynamic"

/** In-memory cache for warm serverless instances (reduces ElevenLabs rate use). */
let voicesCache: { expires: number; payload: Record<string, unknown> } | null = null
const CACHE_MS = 30 * 60 * 1000

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const platformKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!platformKey) {
    return NextResponse.json({
      voices: AI_VOICE_FALLBACK_OPTIONS,
      source: "fallback",
      hint: "Curated voices — add ELEVENLABS_API_KEY (platform) to sync the full premade library.",
    })
  }

  if (voicesCache && Date.now() < voicesCache.expires) {
    return NextResponse.json(voicesCache.payload)
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": platformKey },
    })
    if (!res.ok) {
      return NextResponse.json({
        voices: AI_VOICE_FALLBACK_OPTIONS,
        source: "fallback",
        hint: "Could not reach voice provider; curated list shown.",
      })
    }

    const data = (await res.json()) as {
      voices?: {
        voice_id?: string
        name?: string
        category?: string
        labels?: Record<string, string>
      }[]
    }
    const raw = data.voices || []
    const premadeOnly = raw.filter(
      (v) => String(v.category || "").toLowerCase() === "premade"
    )

    if (premadeOnly.length === 0) {
      return NextResponse.json({
        voices: AI_VOICE_FALLBACK_OPTIONS,
        source: "fallback",
        hint: "No premade voices returned; curated list shown.",
      })
    }

    const voices = mergePremadeVoices(
      premadeOnly.map((v) => ({
        voice_id: String(v.voice_id || ""),
        name: v.name,
        labels: v.labels,
      }))
    )

    const payload = {
      voices,
      source: "elevenlabs",
      count: voices.length,
    }
    voicesCache = { expires: Date.now() + CACHE_MS, payload }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({
      voices: AI_VOICE_FALLBACK_OPTIONS,
      source: "fallback",
      hint: "Voice directory error; curated list shown.",
    })
  }
}
