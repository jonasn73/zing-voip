// ============================================
// GET /api/numbers
// POST /api/numbers (search available numbers)
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { getTwilioClient } from "@/lib/twilio"
import { getPhoneNumbers } from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"
import type { BuyNumberRequest } from "@/lib/types"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const numbers = await getPhoneNumbers(userId)
    return NextResponse.json({ numbers })
  } catch (error) {
    console.error("[Zing] Error fetching numbers:", error)
    return NextResponse.json(
      { error: "Failed to fetch phone numbers" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const body: BuyNumberRequest = await req.json()
    const client = getTwilioClient()

    const available = await client.availablePhoneNumbers("US")
      .local.list({
        areaCode: parseInt(body.area_code, 10),
        limit: 5,
      })

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No numbers available for that area code" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      numbers: available.map((num) => ({
        number: num.phoneNumber,
        friendly_name: num.friendlyName,
        type: "local" as const,
        monthly_cost: 2.99,
      })),
    })
  } catch (error) {
    console.error("[Zing] Error searching numbers:", error)
    return NextResponse.json(
      { error: "Failed to search numbers" },
      { status: 500 }
    )
  }
}
