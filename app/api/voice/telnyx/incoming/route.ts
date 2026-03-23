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
  getUser,
  insertCallLog,
  normalizePhoneNumberE164,
} from "@/lib/db"
import { buildSayThenRedirectToAiBridgeTeXML } from "@/lib/telnyx-ai-handoff"
import { buildTelnyxAiAssistantTexml } from "@/lib/telnyx-ai-texml"
import { ensureTelnyxVoiceAiAssistant } from "@/lib/telnyx-ai-assistant-lifecycle"

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

type TwimlInstance = InstanceType<typeof VoiceResponse>

/** Normal `<Response>` from the Twilio builder, or raw XML (e.g. `<Connect><AIAssistant>`). */
type IncomingCallResult = { kind: "twiml"; texml: TwimlInstance } | { kind: "raw"; xml: string }

// Shared logic for routing a call (used by both POST and GET handlers)
async function handleIncomingCall(
  calledNumber: string,
  callerNumber: string,
  callSid: string,
  callerName: string | null,
  webhookFieldKeys: string[]
): Promise<IncomingCallResult> {
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
      return { kind: "twiml", texml }
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
    const wantsAiAfterNoAnswer = String(routing.fallback_type || "").toLowerCase() === "ai"
    const hasReceptionist = Boolean(routing.selected_receptionist_id && routing.receptionist_phone)
    /**
     * **Default (AI fallback, no receptionist):** return **`<Connect><AIAssistant>`** from `/incoming` (no Say, no Redirect).
     * Say→Redirect→ai-bridge caused a **repeating hold message** when Telnyx re-fetched `/incoming` on some setups.
     * Set **`ZING_AI_HANDOFF_TWO_STEP=true`** to restore Say + Redirect → `/ai-bridge` (legacy).
     * Set **`ZING_AI_RING_OWNER_FIRST=true`** to ring the owner’s cell first (Dial + `/fallback`).
     */
    const ringOwnerFirst =
      process.env.ZING_AI_RING_OWNER_FIRST === "1" || process.env.ZING_AI_RING_OWNER_FIRST === "true"
    const twoStepAiHandoff =
      process.env.ZING_AI_HANDOFF_TWO_STEP === "1" || process.env.ZING_AI_HANDOFF_TWO_STEP === "true"
    const useDirectAiWhenNoReceptionist =
      wantsAiAfterNoAnswer && !hasReceptionist && !ringOwnerFirst

    if (useDirectAiWhenNoReceptionist) {
      let user = await getUser(routing.user_id)
      let assistantId =
        user?.telnyx_ai_assistant_id?.trim() || process.env.TELNYX_AI_ASSISTANT_ID?.trim() || ""
      if (!assistantId) {
        const ensured = await ensureTelnyxVoiceAiAssistant(routing.user_id)
        if (ensured.linked && ensured.assistantId?.trim()) assistantId = ensured.assistantId.trim()
      }
      if (assistantId) {
        console.log(
          JSON.stringify({
            zing: "telnyx-incoming-ai-direct",
            userId: routing.user_id,
            handoff: twoStepAiHandoff ? "say-redirect-ai-bridge" : "connect-aiassistant-in-incoming",
            note: "No <Dial> to owner unless ZING_AI_RING_OWNER_FIRST. Use ZING_AI_HANDOFF_TWO_STEP for legacy Say+Redirect.",
          })
        )
        if (twoStepAiHandoff) {
          return { kind: "raw", xml: buildSayThenRedirectToAiBridgeTeXML(routing.user_id, callSid) }
        }
        return { kind: "raw", xml: buildTelnyxAiAssistantTexml(assistantId) }
      }
      console.warn(
        "[Zing] AI direct path skipped — no assistant id; falling back to <Dial> owner + /fallback webhook."
      )
    }

    // When the next step is Voice AI, cap ring time on the first leg so cell voicemail is less likely to answer the Dial.
    const receptionistRingSec = wantsAiAfterNoAnswer
      ? Math.min(routing.ring_timeout_seconds || 20, 22)
      : routing.ring_timeout_seconds || 20
    const ownerRingSec = wantsAiAfterNoAnswer
      ? Math.min(routing.ring_timeout_seconds || 30, 22)
      : routing.ring_timeout_seconds || 30

    const didDigits = businessLineE164.replace(/\D/g, "")
    const fallbackMode = wantsAiAfterNoAnswer
      ? hasReceptionist
        ? "recv-ai"
        : "owner-ai"
      : hasReceptionist
        ? "recv"
        : "owner"
    const fallbackPathBase =
      didDigits.length >= 10
        ? `${appUrl}/api/voice/telnyx/fallback/u/${encodeURIComponent(routing.user_id)}/n/${didDigits}/${fallbackMode}`
        : `${appUrl}/api/voice/telnyx/fallback/u/${encodeURIComponent(routing.user_id)}`
    const modeQuery = didDigits.length < 10 ? `&zingFbMode=${encodeURIComponent(fallbackMode)}` : ""
    const fbQuery = wantsAiAfterNoAnswer ? "&fb=ai" : ""
    const bnQuery = `&bn=${encodeURIComponent(businessLineE164)}`

    if (routing.selected_receptionist_id && routing.receptionist_phone) {
      const recPhone = normalizePhoneNumberE164(routing.receptionist_phone)
      if (debug) console.log(`[Zing] Routing to receptionist: ${routing.receptionist_name || "Receptionist"} (${recPhone})`)
      const dial = texml.dial({
        callerId: calledNumber,
        // Keep the caller on carrier ringback until bridge, which avoids
        // the mid-ring tone change from early answer + handoff.
        answerOnBridge: true,
        timeout: receptionistRingSec,
        action: `${fallbackPathBase}?callSid=${encodeURIComponent(callSid)}${bnQuery}${fbQuery}`,
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
        timeout: ownerRingSec,
        action: `${fallbackPathBase}?callSid=${encodeURIComponent(callSid)}&primary=owner&leg=owner-first${bnQuery}${fbQuery}${modeQuery}`,
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
  return { kind: "twiml", texml }
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

  const out = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName, Object.keys(fields))
  const body = out.kind === "raw" ? out.xml : out.texml.toString()

  return new NextResponse(body, {
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

  const out = await handleIncomingCall(calledNumber, callerNumber, callSid, callerName, Object.keys(fields))
  const body = out.kind === "raw" ? out.xml : out.texml.toString()

  return new NextResponse(body, {
    headers: { "Content-Type": "text/xml" },
  })
}
