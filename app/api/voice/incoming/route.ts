// ============================================
// POST /api/voice/incoming
// ============================================
// Twilio hits this webhook when someone calls your number.
// It reads routing config and returns TwiML instructions.
//
// Twilio sends form-encoded POST data with:
//   Called, Caller, CallSid, Direction, etc.

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
  const calledNumber = formData.get("Called") as string // your Twilio number
  const callerNumber = formData.get("Caller") as string // who's calling
  const callSid = formData.get("CallSid") as string
  const callerName = (formData.get("CallerName") as string) || null

  const twiml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    // 1. Find which user owns this number
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      twiml.say("Sorry, this number is not configured. Goodbye.")
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    // 2. Get their routing config
    const config = await getRoutingConfig(user.id)

    // 3. Log the incoming call
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

    // 4. Determine who to ring
    if (config?.selected_receptionist_id) {
      // Receptionist is selected -- ring them first
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
        // Receptionist not found, ring owner
        const dial = twiml.dial({
          timeout: 30,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
        })
        dial.number(user.phone)
      }
    } else {
      // No receptionist selected -- ring owner directly
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
