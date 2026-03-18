// ============================================
// POST /api/voice/telnyx/fallback
// ============================================
// Telnyx calls this when the Dial ends (receptionist didn't answer, etc.).
// Same logic as Twilio fallback; param name may be DialCallStatus or similar.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import { getRoutingConfig, getUser, updateCallLog } from "@/lib/db"

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  // Telnyx may use DialCallStatus (TwiML-compat) or CallStatus; try both
  const dialStatus =
    (formData.get("DialCallStatus") as string) ||
    (formData.get("CallStatus") as string) ||
    ""
  const callSid = req.nextUrl.searchParams.get("callSid") || ""
  const userId = req.nextUrl.searchParams.get("userId") || ""

  const texml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    if (dialStatus === "completed") {
      texml.hangup()
      return new NextResponse(texml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    const config = await getRoutingConfig(userId)
    const user = await getUser(userId)
    const fallbackType = config?.fallback_type || "owner"

    switch (fallbackType) {
      case "owner": {
        if (user) {
          const calledNum = (formData.get("To") as string) || ""
          texml.say("Please hold while we connect you.")
          const dial = texml.dial({
            callerId: calledNum || undefined,
            timeout: 30,
          })
          dial.number(toE164(user.phone))
        } else {
          texml.say("We're sorry, no one is available. Please leave a message after the beep.")
          texml.record({
            maxLength: 120,
            transcribe: true,
            recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
          })
        }
        break
      }

      case "ai": {
        // If user has a Vapi assistant, transfer the caller to Vapi for natural AI conversation.
        // Otherwise fall back to the basic TeXML Gather-based AI.
        if (user?.vapi_assistant_id) {
          try {
            const { createVapiCall } = await import("@/lib/vapi")
            const callerNumber = (formData.get("From") as string) || ""
            if (callerNumber) {
              await createVapiCall({
                assistantId: user.vapi_assistant_id,
                customerNumber: callerNumber,
              })
              // Vapi will call the customer back — hang up the current leg
              texml.say("Please hold while I connect you with our assistant.")
              texml.pause({ length: 2 })
              texml.hangup()
            } else {
              // No caller number — fall back to basic AI
              texml.redirect(
                { method: "POST" },
                `${appUrl}/api/voice/telnyx/ai-assistant?userId=${userId}&callSid=${callSid}`
              )
            }
          } catch (vapiErr) {
            console.error("[Telnyx] Vapi call failed, falling back to basic AI:", vapiErr)
            texml.redirect(
              { method: "POST" },
              `${appUrl}/api/voice/telnyx/ai-assistant?userId=${userId}&callSid=${callSid}`
            )
          }
        } else {
          texml.redirect(
            { method: "POST" },
            `${appUrl}/api/voice/telnyx/ai-assistant?userId=${userId}&callSid=${callSid}`
          )
        }
        break
      }

      case "voicemail": {
        const greeting = config?.ai_greeting || "Please leave a message after the beep."
        texml.say(greeting)
        texml.record({
          maxLength: 120,
          transcribe: true,
          recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
          action: `${appUrl}/api/voice/telnyx/voicemail-complete?userId=${userId}&callSid=${callSid}`,
        })
        break
      }

      default: {
        texml.say("We're sorry, no one is available right now. Goodbye.")
        texml.hangup()
      }
    }

    if (callSid && dialStatus !== "completed") {
      await updateCallLog(callSid, {
        call_type: fallbackType === "voicemail" ? "voicemail" : "incoming",
        status: dialStatus,
      })
    }
  } catch (error) {
    console.error("[Telnyx] Error in fallback webhook:", error)
    texml.say("We're sorry, there was an error. Please try again later.")
    texml.hangup()
  }

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
