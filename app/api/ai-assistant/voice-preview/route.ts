import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Server-side preview used to proxy Vapi/ElevenLabs. Telnyx assistant audio is previewed in Mission Control.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Voice preview is not available from the server. Open Telnyx Mission Control to test your assistant, or use your browser after we add a local preview.",
      useTelnyxPortal: true,
    },
    { status: 501 }
  )
}
