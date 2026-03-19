// ============================================
// POST /api/voice/telnyx/voicemail-complete
// ============================================
// After <Record> finishes, Telnyx POSTs here. Return short closing TeXML.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse } from "@/lib/telnyx"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function POST(_req: NextRequest) {
  const texml = new VoiceResponse()
  texml.say("Thank you. We will get back to you soon. Goodbye.")
  texml.hangup()
  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
