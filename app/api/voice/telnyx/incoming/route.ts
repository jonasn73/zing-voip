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

// Normalize a US phone number to E.164 (+1XXXXXXXXXX)
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

// Shared logic for routing a call (used by both POST and GET handlers)
async function handleIncomingCall(calledNumber: string, callerNumber: string, callSid: string, callerName: string | null) {
  const texml = new VoiceResponse()
  const appUrl = getAppUrl()
  const debug = process.env.NODE_ENV !== "production"

  if (debug) console.log(`[Zing] Incoming call: To=${calledNumber} From=${callerNumber} CallSid=${callSid}`)

  try {
    // 1. Find which user owns this business number
    const user = await getUserByPhoneNumber(calledNumber)
    if (!user) {
      if (debug) console.log(`[Zing] No user found for number ${calledNumber}`)
      texml.say("Sorry, this number is not configured. Goodbye.")
      texml.hangup()
      return texml
    }

    if (debug) console.log(`[Zing] Found user ${user.id} (${user.name}) for number ${calledNumber}`)

    // 2. Get routing config for this specific business number (falls back to default)
    const config = await getRoutingConfigForNumber(user.id, calledNumber)
    if (debug) console.log(`[Zing] Routing config: receptionist=${config?.selected_receptionist_id || "none"}, fallback=${config?.fallback_type || "owner"}`)

    // 3. Log the incoming call (don't let logging failures break call routing)
    try {
      // Fire-and-forget so Telnyx doesn't wait for database writes.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      void insertCallLog({
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
      }).catch((logErr) => {
        console.error("[Zing] Call log insert failed (continuing with routing):", logErr)
      })
    } catch (logErr) {
      console.error("[Zing] Call log insert failed (continuing with routing):", logErr)
    }

    // 4. Route: receptionist (per-number or default) → owner's cell as fallback
    // callerId is REQUIRED by Telnyx TeXML for the outbound leg — use the business number
    if (config?.selected_receptionist_id) {
      const receptionist = await getReceptionist(config.selected_receptionist_id)
      if (receptionist) {
        const recPhone = toE164(receptionist.phone)
        if (debug) console.log(`[Zing] Routing to receptionist: ${receptionist.name} (${recPhone})`)
        const dial = texml.dial({
          callerId: calledNumber,
          timeout: config.ring_timeout_seconds || 20,
          action: `${appUrl}/api/voice/telnyx/fallback?userId=${user.id}&callSid=${callSid}`,
          method: "POST",
        })
        dial.number(recPhone)
      } else {
        const ownerPhone = toE164(user.phone)
        if (debug) console.log(`[Zing] Receptionist ${config.selected_receptionist_id} not found, routing to owner: ${ownerPhone}`)
        const dial = texml.dial({
          callerId: calledNumber,
          timeout: 30,
        })
        dial.number(ownerPhone)
      }
    } else {
      const ownerPhone = toE164(user.phone)
      if (debug) console.log(`[Zing] No receptionist assigned, routing to owner: ${ownerPhone}`)
      const dial = texml.dial({
        callerId: calledNumber,
        timeout: 30,
      })
      dial.number(ownerPhone)
    }
  } catch (error) {
    console.error("[Telnyx] Error in incoming webhook:", error)
    texml.say("We're sorry, there was an error connecting your call. Please try again later.")
    texml.hangup()
  }

  if (debug) console.log(`[Zing] TeXML response: ${texml.toString().slice(0, 500)}`)
  return texml
}

export async function POST(req: NextRequest) {
  // Log all form fields to diagnose what Telnyx sends
  const formData = await req.formData()
  const allFields: Record<string, string> = {}
  formData.forEach((value, key) => { allFields[key] = String(value) })
  if (process.env.NODE_ENV !== "production") console.log("[Zing] Telnyx webhook fields:", JSON.stringify(allFields))

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
