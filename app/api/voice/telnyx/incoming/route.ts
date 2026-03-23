// ============================================
// POST /api/voice/telnyx/incoming
// ============================================
// Telnyx TeXML: when someone calls your Telnyx number, Telnyx fetches
// instructions from this URL. We return TeXML (TwiML-compatible) to route the call.
//
// Per-number routing: looks up routing config for the specific business number
// being called, so different numbers can route to different receptionists.
// Falls back to the user's default config if no number-specific config exists.

import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import {
  getIncomingRoutingByNumber,
  insertCallLog,
  normalizePhoneNumberE164,
} from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

// Pick the first non-empty webhook field (Telnyx / proxies sometimes rename keys).
function pickField(fields: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key]
    if (value != null && String(value).trim() !== "") return String(value).trim()
  }
  return ""
}

// Read TeXML instruction request body as form fields or JSON.
async function readWebhookFields(req: NextRequest): Promise<Record<string, string>> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase()
  if (contentType.includes("application/json")) {
    try {
      const body = (await req.json()) as Record<string, unknown>
      const out: Record<string, string> = {}
      for (const [key, val] of Object.entries(body)) {
        if (val !== null && val !== undefined && String(val).trim() !== "") out[key] = String(val)
      }
      return out
    } catch {
      return {}
    }
  }
  try {
    const formData = await req.formData()
    const out: Record<string, string> = {}
    formData.forEach((v, k) => {
      out[k] = String(v)
    })
    return out
  } catch {
    return {}
  }
}

function searchParamsToFields(url: URL): Record<string, string> {
  const out: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    out[k] = v
  })
  return out
}

// Shared logic for routing a call (used by both POST and GET handlers)
async function handleIncomingCall(
  calledNumber: string,
  callerNumber: string,
  callSid: string,
  callerName: string | null,
  webhookFieldKeys: string[]
) {
  const texml = new VoiceResponse()
  const appUrl = getAppUrl()
  const debug = process.env.NODE_ENV !== "production"

  if (debug) console.log(`[Zing] Incoming call: To=${calledNumber} From=${callerNumber} CallSid=${callSid}`)

  try {
    // E.164 for DB + fallback URL — must match phone_numbers.number (we also match by digits in SQL).
    const businessLineE164 = calledNumber ? normalizePhoneNumberE164(calledNumber) : ""

    // 1. Resolve owner + per-number routing + receptionist in one DB query.
    const routing = await getIncomingRoutingByNumber(calledNumber)
    if (!routing) {
      console.error(
        "[Zing] No user/routing for inbound — check phone_numbers row matches this line. Detail:",
        JSON.stringify({
          calledRaw: calledNumber,
          businessLineE164,
          digitKey: businessLineE164.replace(/\D/g, ""),
          callerRaw: callerNumber,
          callSid,
          webhookFieldKeys: webhookFieldKeys.slice(0, 40),
        })
      )
      texml.say("Sorry, this number is not configured. Goodbye.")
      texml.hangup()
      return texml
    }

    if (debug) console.log(`[Zing] Found user ${routing.user_id} (${routing.user_name}) for number ${calledNumber}`)
    if (debug) console.log(`[Zing] Routing config: receptionist=${routing.selected_receptionist_id || "none"}, fallback=${routing.fallback_type || "owner"}`)

    // 3. Log the incoming call (don't let logging failures break call routing)
    try {
      // Fire-and-forget so Telnyx doesn't wait for database writes.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      void insertCallLog({
        user_id: routing.user_id,
        provider_call_sid: callSid,
        from_number: callerNumber.trim() ? normalizePhoneNumberE164(callerNumber) : "Unknown",
        to_number: businessLineE164 || normalizePhoneNumberE164(calledNumber),
        caller_name: callerName,
        call_type: "incoming",
        status: "ringing",
        duration_seconds: 0,
        routed_to_receptionist_id: routing.selected_receptionist_id || null,
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
    if (routing.selected_receptionist_id && routing.receptionist_phone) {
      const recPhone = normalizePhoneNumberE164(routing.receptionist_phone)
      if (debug) console.log(`[Zing] Routing to receptionist: ${routing.receptionist_name || "Receptionist"} (${recPhone})`)
      const dial = texml.dial({
        callerId: calledNumber,
        // Keep the caller on carrier ringback until bridge, which avoids
        // the mid-ring tone change from early answer + handoff.
        answerOnBridge: true,
        timeout: routing.ring_timeout_seconds || 20,
        action: `${appUrl}/api/voice/telnyx/fallback/u/${encodeURIComponent(routing.user_id)}?callSid=${encodeURIComponent(callSid)}&bn=${encodeURIComponent(businessLineE164)}`,
        method: "POST",
      })
      dial.number(recPhone)
    } else {
      const ownerPhone = normalizePhoneNumberE164(routing.owner_phone)
      if (debug) console.log(`[Zing] No receptionist assigned, routing to owner: ${ownerPhone}`)
      // Same as receptionist path: if your phone does not answer, POST to fallback so AI / voicemail / second leg can run.
      const dial = texml.dial({
        callerId: calledNumber,
        answerOnBridge: true,
        timeout: routing.ring_timeout_seconds || 30,
        action: `${appUrl}/api/voice/telnyx/fallback/u/${encodeURIComponent(routing.user_id)}?callSid=${encodeURIComponent(callSid)}&primary=owner&bn=${encodeURIComponent(businessLineE164)}`,
        method: "POST",
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
  const fields = await readWebhookFields(req)
  if (process.env.NODE_ENV !== "production") {
    console.log("[Zing] Telnyx webhook fields:", JSON.stringify(fields))
  }

  const calledNumber = pickField(fields, ["To", "Called", "ToNumber", "CalledNumber"])
  const callerNumber = pickField(fields, ["From", "Caller", "RemoteParty"])
  const callSidRaw = pickField(fields, ["CallSid", "CallControlId", "call_control_id"])
  const callSid = callSidRaw.trim() || `zing-${randomUUID()}`
  if (!callSidRaw.trim()) {
    console.error(
      "[Zing] Telnyx incoming missing CallSid/CallControlId — using synthetic id; confirm webhook fields in Telnyx portal."
    )
  }
  const callerName = pickField(fields, ["CallerName", "CallerIDName"]) || null

  const texml = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName, Object.keys(fields))

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const fields = searchParamsToFields(url)
  const calledNumber = pickField(fields, ["To", "Called", "ToNumber", "CalledNumber"])
  const callerNumber = pickField(fields, ["From", "Caller", "RemoteParty"])
  const callSidRaw = pickField(fields, ["CallSid", "CallControlId", "call_control_id"])
  const callSid = callSidRaw.trim() || `zing-${randomUUID()}`
  if (!callSidRaw.trim()) {
    console.error("[Zing] Telnyx incoming (GET) missing CallSid — using synthetic id.")
  }
  const callerName = pickField(fields, ["CallerName", "CallerIDName"]) || null

  const texml = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName, Object.keys(fields))

  return new NextResponse(texml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
