// ============================================
// POST /api/numbers/port
// ============================================
// For Twilio: connect existing number and set voice URL.
// For other carriers: with LOA + document_sids we submit a real Port In to Twilio; otherwise we only save intent (porting).

import { NextRequest, NextResponse } from "next/server"
import { getTwilioClient, getAppUrl } from "@/lib/twilio"
import { createPortInRequest } from "@/lib/twilio-porting"
import { getUserIdFromRequest } from "@/lib/auth"
import { insertPhoneNumber } from "@/lib/db"
import type { PortNumberRequest } from "@/lib/types"

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return phone.startsWith("+") ? phone : `+${digits}`
}

/** Target port date at least 7 days out (US requirement). */
function getTargetPortInDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const body = (await req.json()) as PortNumberRequest

    if (!body.number || !body.current_carrier) {
      return NextResponse.json(
        { error: "Phone number and current carrier are required" },
        { status: 400 }
      )
    }

    const number = normalizePhone(body.number)
    const carrier = String(body.current_carrier).trim().toLowerCase()
    const appUrl = getAppUrl()

    // ----- Already on Twilio: link number and set voice URL -----
    if (carrier === "twilio") {
      const client = getTwilioClient()
      const list = await client.incomingPhoneNumbers.list({ phoneNumber: number })
      if (list.length > 0) {
        const twilioNumber = list[0]
        await client.incomingPhoneNumbers(twilioNumber.sid).update({
          voiceUrl: `${appUrl}/api/voice/incoming`,
          voiceMethod: "POST",
          statusCallback: `${appUrl}/api/voice/status`,
          statusCallbackMethod: "POST",
        })
        await insertPhoneNumber({
          user_id: userId,
          twilio_sid: twilioNumber.sid,
          number,
          friendly_name: number,
          label: "Ported Line",
          type: "local",
          status: "active",
        })
        return NextResponse.json({
          success: true,
          message: "Number connected. Calls will route through Zing—no Twilio setup needed.",
          port: { number, carrier: body.current_carrier, status: "active" },
        })
      }
    }

    // ----- Other carrier: real Port In if we have LOA + documents -----
    const loa = body.losing_carrier_information
    const documentSids = body.document_sids?.length ? body.document_sids : []

    if (carrier !== "twilio" && loa && documentSids.length > 0) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      if (!accountSid) {
        return NextResponse.json(
          { error: "Server misconfiguration: Twilio account not set" },
          { status: 500 }
        )
      }
      const { port_in_request_sid, port_in_request_status } =
        await createPortInRequest({
          accountSid,
          targetPortInDate: getTargetPortInDate(),
          losingCarrierInformation: {
            customer_type: loa.customer_type,
            customer_name: loa.customer_name,
            account_number: loa.account_number,
            account_telephone_number: loa.account_telephone_number,
            authorized_representative: loa.authorized_representative,
            authorized_representative_email: loa.authorized_representative_email,
            address: {
              street: loa.address.street,
              street_2: loa.address.street_2,
              city: loa.address.city,
              state: loa.address.state,
              zip: loa.address.zip,
              country: loa.address.country,
            },
          },
          phoneNumbers: [{ phone_number: number, pin: body.pin ?? undefined }],
          documentSids,
        })

      await insertPhoneNumber({
        user_id: userId,
        twilio_sid: "",
        number,
        friendly_name: number,
        label: "Ported Line",
        type: "local",
        status: "porting",
        port_in_request_sid,
      })

      return NextResponse.json({
        success: true,
        message:
          "Port request submitted to your carrier. Check the email we sent to sign the Letter of Authorization. You'll see \"Porting in progress\" until the number is active (typically 1–2 business days).",
        port: {
          number,
          carrier: body.current_carrier,
          status: "porting",
          port_in_request_sid,
          port_in_request_status,
        },
      })
    }

    // ----- Other carrier without full LOA: save intent only (no Twilio Port In yet) -----
    await insertPhoneNumber({
      user_id: userId,
      twilio_sid: "",
      number,
      friendly_name: number,
      label: "Ported Line",
      type: "local",
      status: "porting",
    })

    return NextResponse.json({
      success: true,
      message:
        "Port request received. You'll see \"Porting in progress\" in Settings. To start the real transfer from your carrier, complete the port form with your account details and a utility bill (see docs).",
      port: {
        number,
        carrier: body.current_carrier,
        status: "porting",
      },
    })
  } catch (error) {
    console.error("[Zing] Error submitting port request:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit port request" },
      { status: 500 }
    )
  }
}
