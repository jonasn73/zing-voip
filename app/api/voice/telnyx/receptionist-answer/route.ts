// ============================================
// GET/POST /api/voice/telnyx/receptionist-answer
// ============================================
// Telnyx fetches this `<Number url="…">` document the instant the receptionist's
// cell phone answers (before bridging to the caller). We:
//   1) broadcast a real-time `call-connected` event to receptionist-{id} so their
//      HUD instantly pops the live intake form, and
//   2) return optional whisper TeXML (line label) that plays only on their leg.
// Broadcast runs in `after()` so Telnyx bridges the call without extra latency.

import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse } from "@/lib/telnyx"
import { sanitizeWhisperPhrase } from "@/lib/inbound-line-whisper"
import { texmlSayWhisperPlain } from "@/lib/texml-say-voice"
import { handleCallConnected } from "@/app/actions/call-events"
import type { ReceptionistBusinessType } from "@/lib/business-type"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

function param(req: NextRequest, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = req.nextUrl.searchParams.get(k)
    if (v != null && v.trim() !== "") return v.trim()
  }
  return null
}

function whisperPhrase(req: NextRequest): string | null {
  const raw = param(req, "p", "phrase")
  if (!raw) return null
  try {
    const cleaned = sanitizeWhisperPhrase(decodeURIComponent(raw))
    return cleaned.length > 0 ? cleaned : null
  } catch {
    return null
  }
}

function normalizeBusinessType(raw: string | null): ReceptionistBusinessType {
  if (raw === "locksmith" || raw === "detailing" || raw === "generic") return raw
  return "generic"
}

async function respond(req: NextRequest): Promise<NextResponse> {
  const receptionistId = param(req, "r", "receptionistId")
  const callLogId = param(req, "cl", "callSid", "callLogId") ?? ""
  const businessType = normalizeBusinessType(param(req, "bt", "businessType"))
  const callerNumber = param(req, "from", "caller")
  const callerName = param(req, "cn", "callerName")
  const businessName = param(req, "bn", "businessName")

  // Broadcast after the response so we never delay the PSTN bridge.
  if (receptionistId) {
    after(async () => {
      try {
        await handleCallConnected({
          receptionistId,
          callLogId,
          businessType,
          callerNumber,
          callerName,
          businessName,
        })
      } catch (e) {
        console.error("[receptionist-answer] broadcast failed:", e)
      }
    })
  }

  const texml = new VoiceResponse()
  const phrase = whisperPhrase(req)
  if (phrase) texmlSayWhisperPlain(texml, phrase)
  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  })
}

export async function GET(req: NextRequest) {
  return respond(req)
}

export async function POST(req: NextRequest) {
  return respond(req)
}
