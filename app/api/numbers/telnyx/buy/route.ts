// ============================================
// POST /api/numbers/telnyx/buy
// ============================================
// Purchase a Telnyx phone number. Body: { phone_number: "+15551234567" }
// After purchase, configure the number in Telnyx Mission Control to use
// your TeXML Application with URL: {APP_URL}/api/voice/telnyx/incoming

import { NextRequest, NextResponse } from "next/server"
import { getTelnyxClient, getAppUrl } from "@/lib/telnyx"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone_number } = body as { phone_number: string }

    const client = getTelnyxClient()
    const order = await client.numberOrders.create({
      phone_numbers: [{ phone_number }],
    })

    const appUrl = getAppUrl()
    const data = order as { data?: { id?: string; phone_numbers?: Array<{ phone_number?: string }> } }
    const firstNumber = data.data?.phone_numbers?.[0]

    return NextResponse.json({
      success: true,
      number: {
        telnyx_order_id: data.data?.id,
        number: firstNumber?.phone_number || phone_number,
        friendly_name: firstNumber?.phone_number || phone_number,
        voice_webhook_url: `${appUrl}/api/voice/telnyx/incoming`,
      },
    })
  } catch (error) {
    console.error("[Telnyx] Error buying number:", error)
    return NextResponse.json(
      { error: "Failed to purchase Telnyx number" },
      { status: 500 }
    )
  }
}
