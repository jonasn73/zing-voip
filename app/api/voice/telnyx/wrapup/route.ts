// ============================================
// GET/POST /api/voice/telnyx/wrapup
// ============================================
// Hands-free voice wrap-up, run on the OUTBOUND callback leg Lyncr places to a mobile operator after
// a job (see lib/mobile-wrapup-callback.ts). The operator is the controlling leg here, so Gather +
// Record both work cleanly.
//
//   step (default)  → "Customer disconnected. Please say 'Booked', 'Pending', or 'Rejected'…"  (speech/DTMF)
//   step=disposition → map the answer → stamp call_logs.disposition + record the lead disposition,
//                      then "Please speak your job details, then hang up to save." + <Record>
//   step=notes       → recordingStatusCallback: transcribe the note → call_logs.internal_notes,
//                      then fire the owner dispatch SMS
//   step=done        → "Saved. Thank you." + hangup (if the leg is still up after recording)

import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import { getTexmlSayVoiceAttributes, texmlSayNatural } from "@/lib/texml-say-voice"
import { setCallLogInternalNotes, type LeadDisposition } from "@/lib/db"
import { recordOperatorDisposition, DISPOSITION_LABEL } from "@/lib/call-disposition"
import { transcribeRecording } from "@/lib/transcribe-audio"
import { sendOwnerDispatchSms } from "@/lib/owner-dispatch-sms"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

type WrapupParams = {
  cl: string // original inbound callSid (the job's call log)
  u: string // owner userId
  r: string // receptionist id
  bn: string // business name
  a: number // re-prompt attempt counter
}

async function mergedFields(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => {
    out[k] = v
  })
  if (req.method === "POST") {
    try {
      const ct = (req.headers.get("content-type") || "").toLowerCase()
      if (ct.includes("application/json")) {
        const json = (await req.json()) as Record<string, unknown>
        for (const [k, v] of Object.entries(json)) if (v != null && !(k in out)) out[k] = String(v)
      } else {
        const form = await req.formData()
        form.forEach((v, k) => {
          if (!(k in out)) out[k] = String(v)
        })
      }
    } catch {
      /* no body */
    }
  }
  return out
}

function readParams(f: Record<string, string>): WrapupParams {
  return {
    cl: (f.cl || f.callSid || "").trim(),
    u: (f.u || f.userId || "").trim(),
    r: (f.r || f.receptionistId || "").trim(),
    bn: (f.bn || "").trim(),
    a: Math.max(0, parseInt(f.a || "0", 10) || 0),
  }
}

function selfUrl(p: WrapupParams, overrides: { step?: string; a?: number }): string {
  const qs = new URLSearchParams()
  qs.set("cl", p.cl)
  qs.set("u", p.u)
  if (p.r) qs.set("r", p.r)
  if (p.bn) qs.set("bn", p.bn)
  if (overrides.step) qs.set("step", overrides.step)
  qs.set("a", String(overrides.a ?? p.a))
  return `${getAppUrl().replace(/\/+$/, "")}/api/voice/telnyx/wrapup?${qs.toString()}`
}

function parseDisposition(f: Record<string, string>): LeadDisposition | null {
  const digits = (f.Digits || f.digits || "").trim()
  if (digits === "1") return "BOOKED"
  if (digits === "2") return "PENDING_TIME"
  if (digits === "3") return "PRICE_REJECTED"
  const speech = (f.SpeechResult || f.speech_result || f.TranscriptionText || "").toLowerCase()
  if (/\bbook/.test(speech)) return "BOOKED"
  if (/\bpend/.test(speech)) return "PENDING_TIME"
  if (/reject|declin|too (much|expensive)|price/.test(speech)) return "PRICE_REJECTED"
  return null
}

function xml(vr: InstanceType<typeof VoiceResponse>): NextResponse {
  return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml; charset=utf-8" } })
}

/** Initial / re-prompt: ask for the disposition by voice or keypad. */
function dispositionPrompt(p: WrapupParams): NextResponse {
  const vr = new VoiceResponse()
  const gather = vr.gather({
    input: ["speech", "dtmf"],
    numDigits: 1,
    timeout: 6,
    speechTimeout: "auto",
    hints: "booked, pending, rejected",
    action: selfUrl(p, { step: "disposition" }),
    method: "POST",
  })
  gather.say(
    getTexmlSayVoiceAttributes(),
    "Customer disconnected. Please say Booked, Pending, or Rejected to log this call. Or press 1 for booked, 2 for pending, 3 for rejected."
  )
  // No input → re-prompt a couple of times, then give up gracefully.
  if (p.a < 2) {
    vr.redirect({ method: "POST" }, selfUrl(p, { a: p.a + 1 }))
  } else {
    texmlSayNatural(vr, "No response received. You can log this call from your Lyncr dashboard. Goodbye.")
    vr.hangup()
  }
  return xml(vr)
}

async function respond(req: NextRequest): Promise<NextResponse> {
  const fields = await mergedFields(req)
  const p = readParams(fields)
  const step = (fields.step || "").trim()

  // Guard: without the job's call id + owner we can't log anything meaningful.
  if (!p.cl || !p.u) {
    const vr = new VoiceResponse()
    texmlSayNatural(vr, "Sorry, this wrap-up session has expired. Goodbye.")
    vr.hangup()
    return xml(vr)
  }

  // --- step=notes: recording finished (server-to-server callback) → transcribe + dispatch. ---
  if (step === "notes") {
    const recordingUrl = (fields.RecordingUrl || fields.RecordingURL || fields.recording_url || "").trim()
    after(async () => {
      try {
        let notes: string | null = null
        if (recordingUrl) notes = await transcribeRecording(recordingUrl)
        if (!notes && recordingUrl) notes = `Voice note (transcription unavailable): ${recordingUrl}`
        if (notes) await setCallLogInternalNotes(p.cl, notes)
        // Owner dispatch SMS with the freshly captured notes.
        const res = await sendOwnerDispatchSms({ userId: p.u, callSid: p.cl, notes })
        if (!res.ok) console.warn(`[wrapup] owner dispatch SMS skipped: ${res.reason}`)
      } catch (e) {
        console.error("[wrapup] notes processing failed:", e)
      }
    })
    return new NextResponse("OK", { status: 200 })
  }

  // --- step=disposition: parse the answer, log it, then ask for the spoken note. ---
  if (step === "disposition") {
    const disposition = parseDisposition(fields)
    if (!disposition) return dispositionPrompt({ ...p, a: p.a + 1 })

    after(async () => {
      try {
        await recordOperatorDisposition({
          userId: p.u,
          disposition,
          providerCallSid: p.cl,
          callLogId: p.cl,
          businessName: p.bn || null,
          receptionistId: p.r || null,
          source: "voice_wrapup",
        })
      } catch (e) {
        console.error("[wrapup] recordOperatorDisposition failed:", e)
      }
    })

    const vr = new VoiceResponse()
    texmlSayNatural(
      vr,
      `Got it. Marked as ${DISPOSITION_LABEL[disposition]}. Please speak your job details, then hang up to save.`
    )
    vr.record({
      maxLength: 120,
      playBeep: true,
      recordingStatusCallback: selfUrl(p, { step: "notes" }),
      recordingStatusCallbackMethod: "POST",
      action: selfUrl(p, { step: "done" }),
      method: "POST",
    } as Parameters<InstanceType<typeof VoiceResponse>["record"]>[0])
    return xml(vr)
  }

  // --- step=done: recording ended while the leg is still up. ---
  if (step === "done") {
    const vr = new VoiceResponse()
    texmlSayNatural(vr, "Saved. Thank you. Goodbye.")
    vr.hangup()
    return xml(vr)
  }

  // --- default: opening prompt. ---
  return dispositionPrompt(p)
}

export async function GET(req: NextRequest) {
  return respond(req)
}

export async function POST(req: NextRequest) {
  return respond(req)
}
