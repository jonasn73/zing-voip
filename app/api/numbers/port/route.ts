// ============================================
// POST /api/numbers/port
// ============================================
// Initiates a port-in request: creates a Telnyx port order so your number
// actually transfers from the current carrier (e.g. Twilio) to Telnyx/Zing.

import { NextRequest, NextResponse } from "next/server"
import { getTelnyxClient } from "@/lib/telnyx"
import type { PortNumberRequest } from "@/lib/types"

/** Normalize to E.164 (e.g. +15025571219) for Telnyx. */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return raw.startsWith("+") ? raw : `+${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const body: PortNumberRequest = await req.json()

    if (!body.number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    const e164 = toE164(body.number)
    const client = getTelnyxClient()

    // Create a Telnyx port order so the number actually transfers to your Telnyx account.
    const order = await client.portingOrders.create({
      phone_numbers: [e164],
    })

    const data = order as { data?: { id?: string; porting_order_status?: string } }
    const portOrderId = data.data?.id ?? null
    const status = data.data?.porting_order_status ?? "draft"

    return NextResponse.json({
      success: true,
      message: "Port started. Complete the steps in Telnyx (LOA, etc.) to finish. Typically 24-48 hours.",
      port: {
        number: e164,
        carrier: body.current_carrier ?? null,
        status: "porting",
        port_order_id: portOrderId,
        telnyx_status: status,
      },
    })
  } catch (error: unknown) {
    console.error("[Zing] Error submitting port request:", error)
    const message = error instanceof Error ? error.message : "Failed to submit port request"
    const isPortability = /portab|not portable|invalid number/i.test(message)
    return NextResponse.json(
      { error: isPortability ? `This number may not be portable: ${message}` : message },
      { status: isPortability ? 400 : 500 }
    )
  }
}
