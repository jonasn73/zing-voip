// ============================================
// GET /api/numbers/telnyx
// ============================================
// Search available Telnyx phone numbers by area code (US).
// Returns a list of numbers you can then buy via POST /api/numbers/telnyx/buy

import { NextRequest, NextResponse } from "next/server"
import { getTelnyxClient } from "@/lib/telnyx"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const areaCode = searchParams.get("area_code") || "212"
    const type = (searchParams.get("type") as "local" | "toll_free") || "local"

    const client = getTelnyxClient()
    const response = await client.availablePhoneNumbers.list({
      filter: {
        country_code: "US",
        national_destination_code: areaCode,
        phone_number_type: type,
        features: ["voice"],
        limit: 10,
      },
    })

    const numbers = (response.data || []).map((item) => ({
      number: item.phone_number || "",
      friendly_name: item.phone_number || "",
      type: type,
      monthly_cost: item.cost_information?.monthly_cost ?? 1.0,
    }))

    return NextResponse.json({ numbers })
  } catch (error) {
    console.error("[Telnyx] Error searching numbers:", error)
    return NextResponse.json(
      { error: "Failed to search Telnyx numbers" },
      { status: 500 }
    )
  }
}
