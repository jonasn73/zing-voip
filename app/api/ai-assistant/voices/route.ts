import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listTelnyxProviderVoices } from "@/lib/telnyx-ai-catalog"

export const dynamic = "force-dynamic"

/** Telnyx TTS voices (provider=telnyx) for the Advanced AI voice picker. */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const voices = await listTelnyxProviderVoices()
    return NextResponse.json({ voices, source: "telnyx" })
  } catch (e) {
    console.error("[GET /api/ai-assistant/voices]", e)
    return NextResponse.json({ voices: [], source: "telnyx", error: "Could not load voices" }, { status: 200 })
  }
}
