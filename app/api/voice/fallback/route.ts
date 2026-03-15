// ============================================
// POST /api/voice/fallback
// ============================================
// Twilio hits this when the receptionist doesn't answer
// (the "action" URL from the <Dial> in /incoming).
// 
// DialCallStatus values: completed, no-answer, busy, failed, canceled

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/twilio"
import { getRoutingConfig, getUser, updateCallLog } from "@/lib/db"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const dialStatus = formData.get("DialCallStatus") as string
  const callSid = req.nextUrl.searchParams.get("callSid") || ""
  const userId = req.nextUrl.searchParams.get("userId") || ""

  const twiml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    // If receptionist answered, call is done
    if (dialStatus === "completed") {
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    // Receptionist didn't answer -- check fallback setting
    const config = await getRoutingConfig(userId)
    const user = await getUser(userId)
    const fallbackType = config?.fallback_type || "owner"

    switch (fallbackType) {
      case "owner": {
        // Ring the business owner's phone
        if (user) {
          twiml.say("Please hold while we connect you.")
          const dial = twiml.dial({
            timeout: 30,
            record: "record-from-answer-dual",
            recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
          })
          dial.number(user.phone)
        } else {
          twiml.say("We're sorry, no one is available. Please leave a message after the beep.")
          twiml.record({
            maxLength: 120,
            transcribe: true,
            recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
          })
        }
        break
      }

      case "ai": {
        // Connect to AI assistant
        // This redirects to the AI handler which uses Twilio Media Streams
        // or <Gather> + AI SDK to converse with the caller
        twiml.redirect({
          method: "POST",
        }, `${appUrl}/api/voice/ai-assistant?userId=${userId}&callSid=${callSid}`)
        break
      }

      case "voicemail": {
        // Send to voicemail
        const greeting = config?.ai_greeting || "Please leave a message after the beep."
        twiml.say(greeting)
        twiml.record({
          maxLength: 120,
          transcribe: true,
          recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
          action: `${appUrl}/api/voice/voicemail-complete?userId=${userId}&callSid=${callSid}`,
        })
        break
      }

      default: {
        twiml.say("We're sorry, no one is available right now. Goodbye.")
        twiml.hangup()
      }
    }

    // Update call log with missed/no-answer status
    if (callSid && dialStatus !== "completed") {
      await updateCallLog(callSid, {
        call_type: fallbackType === "voicemail" ? "voicemail" : "incoming",
        status: dialStatus,
      })
    }
  } catch (error) {
    console.error("[Switchr] Error in fallback webhook:", error)
    twiml.say("We're sorry, there was an error. Please try again later.")
    twiml.hangup()
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
