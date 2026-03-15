// ============================================
// POST /api/voice/telnyx/incoming
// ============================================
// Telnyx TeXML: when someone calls your Telnyx number, Telnyx fetches
// instructions from this URL. We return TeXML (TwiML-compatible) to route the call.
//
// Telnyx sends GET or POST with: From, To, CallSid, AccountSid, etc.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import {
  getUserByPhoneNumber,
  getRoutingConfig,
  getReceptionist,
  insertCallLog,
} from "@/lib/db"

export async function POST(req: NextRequest) {
  // Telnyx sends form-encoded body (or query for GET)
  const formData = await req.formData()
  const calledNumber = (formData.get("To") as string) || "" // your Telnyx number
  const callerNumber = (formData.get("From") as string) || "" // who's calling
  const callSid = (formData.get("CallSid") as string) || ""
  const callerName = (formData.get("CallerName") as string) || null

  const texml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    // 1. Find which user owns this number
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      texml.say("Sorry, this number is not configured. Goodbye.")
      texml.hangup()
      return new NextResponse(texml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    // 2. Get their routing config
    const config = await getRoutingConfig(user.id)

    // 3. Log the incoming call (store Telnyx CallSid in same field as Twilio)
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

    // 4. Who to ring (receptionist first, or owner)
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
        const dial = texml.dial({
          timeout: 30,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
        })
        dial.number(user.phone)
      }
    } else {
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

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}

// Telnyx can use GET for instruction fetching; forward to same logic
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const calledNumber = url.searchParams.get("To") || ""
  const callerNumber = url.searchParams.get("From") || ""
  const callSid = url.searchParams.get("CallSid") || ""
  const callerName = url.searchParams.get("CallerName") || null

  const texml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      texml.say("Sorry, this number is not configured. Goodbye.")
      texml.hangup()
      return new NextResponse(texml.toString(), {
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
        const dial = texml.dial({
          timeout: config.ring_timeout_seconds || 20,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
          action: `${appUrl}/api/voice/telnyx/fallback?userId=${user.id}&callSid=${callSid}`,
          method: "POST",
        })
        dial.number(receptionist.phone)
      } else {
        const dial = texml.dial({
          timeout: 30,
          record: "record-from-answer-dual",
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
        })
        dial.number(user.phone)
      }
    } else {
      const dial = texml.dial({
        timeout: 30,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
      })
      dial.number(user.phone)
    }
  } catch (error) {
    console.error("[Telnyx] Error in incoming webhook (GET):", error)
    texml.say("We're sorry, there was an error connecting your call. Please try again later.")
    texml.hangup()
  }

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
