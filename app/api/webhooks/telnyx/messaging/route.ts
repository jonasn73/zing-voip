// POST /api/webhooks/telnyx/messaging — inbound SMS + delivery status (ack only for now).

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    await req.json().catch(() => null)
  } catch {
    // Telnyx only needs a 2xx — body is optional for outbound-only setups.
  }
  return NextResponse.json({ ok: true })
}
