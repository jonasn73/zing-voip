// ============================================
// POST /api/voice/telnyx/fallback
// ============================================
// Telnyx calls this when the Dial ends (receptionist didn't answer, etc.).
// Uses TeXML-compatible Dial callback fields like DialCallStatus/CallStatus.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import type { FallbackType } from "@/lib/types"
import {
  getRoutingConfig,
  getRoutingConfigForNumber,
  getIncomingRoutingByNumber,
  getUser,
  updateCallLog,
} from "@/lib/db"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

function normalizeFallbackType(v: string | undefined | null): FallbackType {
  const s = (v || "owner").toLowerCase().trim()
  if (s === "ai" || s === "voicemail" || s === "owner") return s
  return "owner"
}

/**
 * Telnyx sometimes POSTs to the Dial `action` URL without preserving query params (`bn` lost).
 * The parent inbound leg usually still includes the business DID in `To` (TwiML-compatible).
 */
function resolveBusinessLineE164(bnFromQuery: string, formData: FormData): string {
  const q = bnFromQuery.trim()
  if (q) return toE164(q)
  const keys = ["To", "Called", "called", "OriginalCalledNumber", "DialedNumber"]
  for (const k of keys) {
    const raw = formData.get(k)
    const s = raw != null ? String(raw).trim() : ""
    if (s.replace(/\D/g, "").length >= 10) return toE164(s)
  }
  return ""
}

/** Zing no longer uses the legacy TeXML + LLM loop; if Vapi cannot run, send callers to voicemail. */
function playIndustryAiUnavailableVoicemail(
  texml: InstanceType<typeof VoiceResponse>, // Same TeXML builder type as `new VoiceResponse()` in this file
  appUrl: string,
  userId: string,
  callSid: string
) {
  texml.say(
    "Thanks for calling. Our automated assistant is not available on this line right now. Please leave your name, phone number, and what you need after the tone and we will get back to you."
  )
  texml.record({
    maxLength: 120,
    transcribe: true,
    recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
    action: `${appUrl}/api/voice/telnyx/voicemail-complete?userId=${userId}&callSid=${callSid}`,
  })
}

/** Twilio/Telnyx TeXML: Dial action sends DialCallDuration (seconds) when the dialed leg ends. */
function parseDialDurationSeconds(formData: FormData): number {
  const raw =
    (formData.get("DialCallDuration") as string) ||
    (formData.get("DialCallDurationSeconds") as string) ||
    ""
  let n = parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  // Some providers send milliseconds for duration-like fields
  if (n > 600) n = Math.round(n / 1000)
  return n
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  if (process.env.NODE_ENV !== "production") {
    const fields: Record<string, string> = {}
    formData.forEach((v, k) => {
      fields[k] = String(v)
    })
    console.log("[Zing] Telnyx fallback webhook:", JSON.stringify(fields))
  }

  // Telnyx may use DialCallStatus (TwiML-compat) or CallStatus; normalize like no-answer / no_answer
  const rawStatus =
    (formData.get("DialCallStatus") as string) ||
    (formData.get("CallStatus") as string) ||
    ""
  const dialStatus = rawStatus.trim().toLowerCase().replace(/_/g, "-")
  const dialDurationSec = parseDialDurationSeconds(formData)

  const callSid = req.nextUrl.searchParams.get("callSid") || ""
  const userId = req.nextUrl.searchParams.get("userId") || ""
  const bnFromQuery = req.nextUrl.searchParams.get("bn")?.trim() || ""
  const businessLineE164 = resolveBusinessLineE164(bnFromQuery, formData)
  /** Set when the first leg already rang the owner's cell (vs receptionist first). */
  const primaryWasOwner = req.nextUrl.searchParams.get("primary") === "owner"

  const texml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    // "completed" = dialed party answered, then the bridged leg ended (TwiML semantics).
    // If they only picked up briefly or declined oddly, duration is often short — still run AI/voicemail.
    // After a real conversation (long bridged time), end the caller's session so we don't stack AI on top.
    const answeredAndHadConversation = dialStatus === "completed" && dialDurationSec >= 8
    if (answeredAndHadConversation) {
      texml.hangup()
      return new NextResponse(texml.toString(), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    const [config, user] = await Promise.all([
      businessLineE164
        ? getRoutingConfigForNumber(userId, businessLineE164)
        : getRoutingConfig(userId),
      getUser(userId),
    ])

    // Same SQL path as /incoming TeXML — authoritative fallback_type (per-number row + default).
    const liveRouting =
      businessLineE164.length > 0
        ? await getIncomingRoutingByNumber(businessLineE164, { bypassCache: true })
        : null

    const fallbackType = normalizeFallbackType(
      liveRouting && liveRouting.user_id === userId
        ? liveRouting.fallback_type
        : config?.fallback_type
    )

    console.log(
      JSON.stringify({
        zing: "telnyx-fallback",
        userId,
        businessLineE164: businessLineE164 || null,
        hadBnQuery: Boolean(bnFromQuery),
        toField: String(formData.get("To") || ""),
        fallbackType,
        hasVapiAssistant: Boolean(user?.vapi_assistant_id),
        dialStatus: dialStatus || rawStatus || null,
      })
    )

    switch (fallbackType) {
      case "owner": {
        // First leg was already your phone — do not dial the same number again (would loop).
        if (primaryWasOwner) {
          const greeting =
            config?.ai_greeting?.trim() || "Sorry we could not reach you. Please leave a message after the tone."
          texml.say(greeting)
          texml.record({
            maxLength: 120,
            transcribe: true,
            recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
            action: `${appUrl}/api/voice/telnyx/voicemail-complete?userId=${userId}&callSid=${callSid}`,
          })
          break
        }
        if (user) {
          const calledNum = (formData.get("To") as string) || ""
          const dial = texml.dial({
            callerId: calledNum || undefined,
            // Keep ringback behavior consistent on fallback owner transfer.
            answerOnBridge: true,
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
        // Industry playbook runs only on Vapi — legacy TeXML + LLM path has been removed.
        if (user?.vapi_assistant_id) {
          try {
            const { createVapiCall } = await import("@/lib/vapi")
            const callerNumber = (formData.get("From") as string) || ""
            if (callerNumber) {
              await createVapiCall({
                assistantId: user.vapi_assistant_id,
                customerNumber: callerNumber,
              })
              texml.say("Please hold while I connect you with our assistant.")
              texml.pause({ length: 2 })
              texml.hangup()
            } else {
              playIndustryAiUnavailableVoicemail(texml, appUrl, userId, callSid)
            }
          } catch (vapiErr) {
            console.error("[Telnyx] Vapi call failed, using voicemail:", vapiErr)
            playIndustryAiUnavailableVoicemail(texml, appUrl, userId, callSid)
          }
        } else {
          playIndustryAiUnavailableVoicemail(texml, appUrl, userId, callSid)
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

    if (callSid && !answeredAndHadConversation) {
      // Fire-and-forget: don't delay TeXML response while updating call logs.
      void updateCallLog(callSid, {
        call_type: fallbackType === "voicemail" ? "voicemail" : "incoming",
        status: dialStatus || rawStatus || "unknown",
      }).catch((logErr) => {
        console.error("[Zing] Call log update failed (continuing):", logErr)
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
