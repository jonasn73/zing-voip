// ============================================
// POST /api/numbers/telnyx/buy
// ============================================
// Purchase a Telnyx phone number, configure it with our TeXML webhook,
// and save it to the database.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { insertPhoneNumber } from "@/lib/db"
import { getTelnyxApiKey } from "@/lib/telnyx-config"
import { purchaseAndConfigureTelnyxLine } from "@/lib/telnyx-purchase-line"

const MAX_LINE_BUSINESS_NAME_LEN = 120

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  getTelnyxApiKey()

  try {
    const body = await req.json()
    const { phone_number, line_business_name } = body as { phone_number: string; line_business_name?: string }

    if (!phone_number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    const label =
      typeof line_business_name === "string" ? line_business_name.trim().slice(0, MAX_LINE_BUSINESS_NAME_LEN) : ""
    if (!label) {
      return NextResponse.json(
        { error: "Business name for this line is required (what your team hears for this number)." },
        { status: 400 }
      )
    }

    const purchase = await purchaseAndConfigureTelnyxLine(phone_number)
    if (!purchase.ok) {
      return NextResponse.json({ error: purchase.error }, { status: 422 })
    }

    const saved = await insertPhoneNumber({
      user_id: userId,
      number: purchase.phone_number,
      friendly_name: purchase.phone_number,
      label,
      type: "local",
      status: "active",
      provider_number_sid: purchase.order_id,
    })

    console.log(`[Sigo] Number ${purchase.phone_number} purchased, configured, and saved (order: ${purchase.order_id}, db: ${saved.id})`)

    return NextResponse.json({
      success: true,
      number: {
        id: saved.id,
        telnyx_order_id: purchase.order_id,
        number: purchase.phone_number,
        friendly_name: purchase.phone_number,
        label: saved.label,
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
