// ============================================
// POST /api/webhooks/vapi (deprecated)
// ============================================
// Zing no longer uses Vapi. Lead capture from Telnyx Voice AI will use a future webhook.

import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json(
    {
      error: "gone",
      message:
        "Zing uses Telnyx Voice AI on the live call. This Vapi webhook is disabled. Configure tools in Telnyx if you need lead callbacks.",
    },
    { status: 410 }
  )
}
