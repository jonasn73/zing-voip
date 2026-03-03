// ============================================
// POST /api/numbers/porting-webhook
// ============================================
// Twilio calls this when a port-in request or phone number status changes.
// When a number is completed we set its voice URL and mark it active in our DB.

import { NextRequest, NextResponse } from "next/server"
import { getTwilioClient, getAppUrl } from "@/lib/twilio"
import {
  getPhoneNumberByNumberAndStatus,
  updatePhoneNumber,
} from "@/lib/db"

/** Twilio sends this shape for port-in webhooks. */
interface PortingWebhookBody {
  port_in_request_sid?: string
  port_in_phone_number_sid?: string
  last_date_updated?: string
  phone_number?: string | null
  status?: string
  portable?: string
  not_portable_reason_code?: string | null
  not_portable_reason?: string | null
  rejection_reason?: string | null
  rejection_reason_code?: string | null
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return phone.startsWith("+") ? phone : `+${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PortingWebhookBody
    const phoneNumber = body.phone_number
    const status = (body.status || "").toLowerCase()

    // Only act when the number has been successfully ported to Twilio
    const isCompleted =
      status === "completed" ||
      status.includes("completed") ||
      status === "port_in_phone_number_completed"

    if (!phoneNumber || !isCompleted) {
      return NextResponse.json({ received: true })
    }

    const number = normalizePhone(phoneNumber)
    const row = await getPhoneNumberByNumberAndStatus(number, "porting")
    if (!row) {
      return NextResponse.json({ received: true })
    }

    const client = getTwilioClient()
    const list = await client.incomingPhoneNumbers.list({
      phoneNumber: number,
    })
    if (list.length === 0) {
      return NextResponse.json({ received: true })
    }

    const twilioNumber = list[0]
    const appUrl = getAppUrl()

    await client.incomingPhoneNumbers(twilioNumber.sid).update({
      voiceUrl: `${appUrl}/api/voice/incoming`,
      voiceMethod: "POST",
      statusCallback: `${appUrl}/api/voice/status`,
      statusCallbackMethod: "POST",
    })

    await updatePhoneNumber(row.id, row.user_id, {
      twilio_sid: twilioNumber.sid,
      status: "active",
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[Zing] Porting webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
