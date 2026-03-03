// ============================================
// POST /api/numbers/buy
// ============================================
// Purchases a Twilio number and saves it to the DB for the current user.

import { NextRequest, NextResponse } from "next/server"
import { getTwilioClient, getAppUrl } from "@/lib/twilio"
import { getUserIdFromRequest } from "@/lib/auth"
import { insertPhoneNumber } from "@/lib/db"

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { phone_number } = body as { phone_number: string }

    const client = getTwilioClient()
    const appUrl = getAppUrl()

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: phone_number,
      voiceUrl: `${appUrl}/api/voice/incoming`,
      voiceMethod: "POST",
      statusCallback: `${appUrl}/api/voice/status`,
      statusCallbackMethod: "POST",
    })

    await insertPhoneNumber({
      user_id: userId,
      twilio_sid: purchased.sid,
      number: purchased.phoneNumber,
      friendly_name: purchased.friendlyName ?? purchased.phoneNumber,
      label: "New Line",
      type: "local",
      status: "active",
    })

    return NextResponse.json({
      success: true,
      number: {
        twilio_sid: purchased.sid,
        number: purchased.phoneNumber,
        friendly_name: purchased.friendlyName,
      },
    })
  } catch (error) {
    console.error("[Zing] Error buying number:", error)
    return NextResponse.json(
      { error: "Failed to purchase number" },
      { status: 500 }
    )
  }
}
