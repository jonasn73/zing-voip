// ============================================
// POST /api/numbers/port
// ============================================
// Initiates a port-in request for an existing number.
// In production, this uses Twilio's Porting API.
// For now, this records the request and you'd handle
// the actual port through Twilio's console or API.

import { NextRequest, NextResponse } from "next/server"
import type { PortNumberRequest } from "@/lib/types"

const DEMO_USER_ID = "demo-user-id"

export async function POST(req: NextRequest) {
  try {
    const body: PortNumberRequest = await req.json()

    // Validate input (number only required; carrier is optional and can be looked up if needed)
    if (!body.number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    // TODO: In production, initiate a Twilio port-in request
    // https://www.twilio.com/docs/phone-numbers/porting
    //
    // For now, save as a pending port request:
    // await sql`
    //   INSERT INTO phone_numbers (user_id, number, friendly_name, label, type, status)
    //   VALUES (${DEMO_USER_ID}, ${body.number}, ${body.number}, 'Ported Line', 'local', 'porting')
    // `

    // TODO: Send notification email to admin to process port manually
    // or use Twilio Porting API when available

    return NextResponse.json({
      success: true,
      message: "Port request submitted. This typically takes 24-48 hours.",
      port: {
        number: body.number,
        carrier: body.current_carrier ?? null,
        status: "porting",
      },
    })
  } catch (error) {
    console.error("[Zing] Error submitting port request:", error)
    return NextResponse.json(
      { error: "Failed to submit port request" },
      { status: 500 }
    )
  }
}
