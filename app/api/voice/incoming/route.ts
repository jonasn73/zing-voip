// ============================================
// POST /api/voice/incoming
// ============================================
// Twilio hits this webhook when someone calls your number.
// It reads routing config and returns TwiML instructions.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/twilio"
import {
  getUserByPhoneNumber,
  getRoutingConfig,
  getReceptionist,
  insertCallLog,
} from "@/lib/db"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const calledNumber = formData.get("Called") as string
  const callerNumber = formData.get("Caller") as string
  const callSid = formData.get("CallSid") as string
  const callerName = (formData.get("CallerName") as string) || null

  const twiml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      twiml.say("Sorry, this number is not configured. Goodbye.")
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    const config = await getRoutingConfig(user.id)

    await insertCallLog({
      user_id: user.id,
      twilio_call_sid: callSid,
      from_number: callerNumber,
      to_number: calledNumber,
      caller_name: callerName,
      call_type: "incoming",
      status: "ringing",
      duration_seconds: 0,
      routed_to_receptionist_id: config?.selected_receptionist_id || null,
      routed_to_name: null,
      has_recording: false,
      recording_url: null,
      recording_duration_seconds: null,
    })

    if (config?.selected_receptionist_id) {
      const receptionist = await getReceptionist(config.selected_receptionist_id)
      if (receptionist) {
        const dial = twiml.dial({
          timeout: config.ring_timeout_seconds || 20,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
          action: `${appUrl}/api/voice/fallback?userId=${user.id}&callSid=${callSid}`,
          method: "POST",
        })
        dial.number(receptionist.phone)
      } else {
        const dial = twiml.dial({
          timeout: 30,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
        })
        dial.number(user.phone)
      }
    } else {
      const dial = twiml.dial({
        timeout: 30,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
      })
      dial.number(user.phone)
    }
  } catch (error) {
    console.error("[Zing] Error in incoming webhook:", error)
    twiml.say("We're sorry, there was an error connecting your call. Please try again later.")
    twiml.hangup()
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
