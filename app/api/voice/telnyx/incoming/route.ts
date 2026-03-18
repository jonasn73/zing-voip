// ============================================
// POST /api/voice/telnyx/incoming
// ============================================
// Telnyx TeXML: when someone calls your Telnyx number, Telnyx fetches
// instructions from this URL. We return TeXML (TwiML-compatible) to route the call.
//
// Per-number routing: looks up routing config for the specific business number
// being called, so different numbers can route to different receptionists.
// Falls back to the user's default config if no number-specific config exists.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import {
  getUserByPhoneNumber,
  getRoutingConfigForNumber,
  getReceptionist,
  insertCallLog,
} from "@/lib/db"

// Shared logic for routing a call (used by both POST and GET handlers)
async function handleIncomingCall(calledNumber: string, callerNumber: string, callSid: string, callerName: string | null) {
  const texml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    // 1. Find which user owns this business number
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      texml.say("Sorry, this number is not configured. Goodbye.")
      texml.hangup()
      return texml
    }

    // 2. Get routing config for this specific business number (falls back to default)
    const config = await getRoutingConfigForNumber(user.id, calledNumber)

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

    // 4. Route: receptionist (per-number or default) → owner's cell as fallback
    if (config?.selected_receptionist_id) {
      const receptionist = await getReceptionist(config.selected_receptionist_id)
      if (receptionist) {
        const dial = texml.dial({
          timeout: config.ring_timeout_seconds || 20,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
          action: `${appUrl}/api/voice/telnyx/fallback?userId=${user.id}&callSid=${callSid}`,
          method: "POST",
        })
        dial.number(receptionist.phone)
      } else {
        // Receptionist not found — ring owner's cell
        const dial = texml.dial({
          timeout: 30,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
        })
        dial.number(user.phone)
      }
    } else {
      // No receptionist assigned — ring owner's cell directly
      const dial = texml.dial({
        timeout: 30,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
      })
      dial.number(user.phone)
    }
  } catch (error) {
    console.error("[Telnyx] Error in incoming webhook:", error)
    texml.say("We're sorry, there was an error connecting your call. Please try again later.")
    texml.hangup()
  }

  return texml
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const calledNumber = (formData.get("To") as string) || ""
  const callerNumber = (formData.get("From") as string) || ""
  const callSid = (formData.get("CallSid") as string) || ""
  const callerName = (formData.get("CallerName") as string) || null

  const texml = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName)

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const calledNumber = url.searchParams.get("To") || ""
  const callerNumber = url.searchParams.get("From") || ""
  const callSid = url.searchParams.get("CallSid") || ""
  const callerName = url.searchParams.get("CallerName") || null

  const texml = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName)

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
