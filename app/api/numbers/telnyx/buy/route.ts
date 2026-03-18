// ============================================
// POST /api/numbers/telnyx/buy
// ============================================
// Purchase a Telnyx phone number and save it to the database.
// Body: { phone_number: "+15551234567" }

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { insertPhoneNumber } from "@/lib/db"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { phone_number } = body as { phone_number: string }

    if (!phone_number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    // Purchase the number via Telnyx
    const res = await fetch(`${TELNYX_BASE}/number_orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_numbers: [{ phone_number }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || "Purchase failed"
      console.error("[Telnyx] Buy error:", errMsg)
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const orderId = data?.data?.id || ""
    const boughtNumber = data?.data?.phone_numbers?.[0]?.phone_number || phone_number

    // Save the number to our database so it shows up in the user's business numbers
    const saved = await insertPhoneNumber({
      user_id: userId,
      number: boughtNumber,
      friendly_name: boughtNumber,
      label: "Business Line",
      type: "local",
      status: "active",
      twilio_sid: orderId,
    })

    console.log(`[Zing] Number ${boughtNumber} purchased and saved (order: ${orderId}, db: ${saved.id})`)

    return NextResponse.json({
      success: true,
      number: {
        id: saved.id,
        telnyx_order_id: orderId,
        number: boughtNumber,
        friendly_name: boughtNumber,
      },
    })
  } catch (error) {
    console.error("[Telnyx] Error buying number:", error)
    return NextResponse.json(
      { error: "Failed to purchase number" },
      { status: 500 }
    )
  }
}
