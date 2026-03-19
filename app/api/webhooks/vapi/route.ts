// ============================================
// POST /api/webhooks/vapi
// ============================================
// Vapi calls this when the assistant runs a tool (e.g. submit_zing_lead).
// Optional: set VAPI_WEBHOOK_SECRET and open …/api/webhooks/vapi?s=YOUR_SECRET in Vapi.

import { NextRequest, NextResponse } from "next/server"
import {
  getUserByVapiAssistantId,
  getAiIntakeConfigRaw,
  insertAiLead,
} from "@/lib/db"
import { sendTelnyxSms } from "@/lib/telnyx-sms"
import { normalizeIntakeConfig } from "@/lib/ai-intake-defaults"
import { toE164 } from "@/lib/phone-e164"

export const runtime = "nodejs"

/** Pull nested assistant id from a Vapi call object (shape varies by API version). */
function assistantIdFromCall(call: Record<string, unknown> | null | undefined): string | null {
  if (!call) return null
  const direct = call.assistantId ?? call.assistant_id
  if (typeof direct === "string" && direct) return direct
  const nested = call.assistant as Record<string, unknown> | undefined
  if (nested && typeof nested.id === "string") return nested.id
  return null
}

/** Caller’s number from the call object when present. */
function callerFromCall(call: Record<string, unknown> | null | undefined): string | null {
  if (!call) return null
  const customer = call.customer as Record<string, unknown> | undefined
  const num = customer?.number ?? call.customerNumber ?? call.from
  return typeof num === "string" && num ? num : null
}

/** Vapi call id for support / dedupe. */
function vapiCallIdFromPayload(call: Record<string, unknown> | null | undefined): string | null {
  if (!call) return null
  const id = call.id ?? call.callId
  return typeof id === "string" ? id : null
}

/** Parse arguments from one tool-call entry (OpenAI-style or flat parameters). */
function toolArgsFromEntry(entry: Record<string, unknown>): Record<string, unknown> {
  let raw =
    entry.parameters ??
    entry.arguments ??
    (entry.function as Record<string, unknown> | undefined)?.arguments ??
    (entry.function as Record<string, unknown> | undefined)?.parameters
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as Record<string, unknown>
    } catch {
      raw = {}
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>
  return {}
}

/** Tool name from one tool-call entry. */
function toolNameFromEntry(entry: Record<string, unknown>): string {
  const fn = entry.function as Record<string, unknown> | undefined
  const n = entry.name ?? fn?.name
  return typeof n === "string" ? n : ""
}

/** Tool call id for the Vapi results array. */
function toolCallIdFromEntry(entry: Record<string, unknown>): string {
  const tc = entry.toolCall as Record<string, unknown> | undefined
  const id = entry.id ?? entry.toolCallId ?? tc?.id
  return typeof id === "string" ? id : ""
}

/** Short SMS body for the owner’s cell. */
function formatLeadSms(params: {
  businessName: string
  intent: string
  summary: string
  callback: string
  extras: string[]
}): string {
  const lines = [
    `[Zing] ${params.businessName}`,
    `Intent: ${params.intent}`,
    `Callback: ${params.callback}`,
    `Summary: ${params.summary}`,
    ...params.extras,
  ]
  return lines.join("\n").slice(0, 1500)
}

export async function POST(req: NextRequest) {
  const expected = process.env.VAPI_WEBHOOK_SECRET?.trim()
  if (expected) {
    const got = req.nextUrl.searchParams.get("s") || ""
    if (got !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const message = (body?.message as Record<string, unknown>) || null
  const type = typeof message?.type === "string" ? message.type : ""

  if (type !== "tool-calls") {
    return NextResponse.json({})
  }

  const call = (message.call as Record<string, unknown>) || null
  const assistantId = assistantIdFromCall(call)
  const user = assistantId ? await getUserByVapiAssistantId(assistantId) : null

  const list = (message.toolCallList as Record<string, unknown>[]) || []
  const results: { name: string; toolCallId: string; result: string }[] = []

  for (const entry of list) {
    const name = toolNameFromEntry(entry)
    const toolCallId = toolCallIdFromEntry(entry)
    const args = toolArgsFromEntry(entry)

    if (name !== "submit_zing_lead" || !toolCallId) {
      results.push({
        name: name || "unknown",
        toolCallId: toolCallId || "missing",
        result: JSON.stringify({ ok: false, error: "ignored" }),
      })
      continue
    }

    if (!user) {
      results.push({
        name,
        toolCallId,
        result: JSON.stringify({ ok: false, error: "unknown_assistant" }),
      })
      continue
    }

    const intentRaw = args.intent_slug
    const intent_slug = typeof intentRaw === "string" ? intentRaw : "other"
    const callbackRaw = args.callback_number
    const callback_number = typeof callbackRaw === "string" ? callbackRaw : ""
    const summaryRaw = args.issue_summary
    const summary = typeof summaryRaw === "string" ? summaryRaw : ""

    if (!callback_number.trim() || !summary.trim()) {
      results.push({
        name,
        toolCallId,
        result: JSON.stringify({
          ok: false,
          error: "callback_number and issue_summary are required",
        }),
      })
      continue
    }

    const rawIntake = await getAiIntakeConfigRaw(user.id)
    const intake = normalizeIntakeConfig(rawIntake, { userIndustry: user.industry })
    const notify = intake.smsNotify !== false

    const caller_e164 = callerFromCall(call)
    const vapi_call_id = vapiCallIdFromPayload(call)

    let sms_sent = false
    let sms_error: string | null = null

    if (notify && user.phone?.trim()) {
      const extras: string[] = []
      const make = typeof args.vehicle_make === "string" ? args.vehicle_make : ""
      const model = typeof args.vehicle_model === "string" ? args.vehicle_model : ""
      const year = typeof args.vehicle_year === "string" ? args.vehicle_year : ""
      const vehicleLine = [make, model, year].filter(Boolean).join(" ")
      if (vehicleLine) extras.push(`Vehicle: ${vehicleLine}`)
      const addr = args.service_address
      if (typeof addr === "string" && addr) extras.push(`Address: ${addr}`)
      const cname = args.caller_name
      if (typeof cname === "string" && cname) extras.push(`Name: ${cname}`)

      const text = formatLeadSms({
        businessName: user.business_name || user.name || "Lead",
        intent: intent_slug,
        summary,
        callback: callback_number,
        extras,
      })

      const sms = await sendTelnyxSms({ toE164: toE164(user.phone), text })
      if (sms.ok) sms_sent = true
      else sms_error = sms.error
    } else if (notify) {
      sms_error = "owner phone missing"
    } else {
      sms_error = null
    }

    await insertAiLead({
      user_id: user.id,
      caller_e164,
      intent_slug,
      collected: args,
      summary,
      sms_sent,
      sms_error,
      vapi_call_id,
    })

    results.push({
      name,
      toolCallId,
      result: JSON.stringify({ ok: true, saved: true, sms_sent }),
    })
  }

  return NextResponse.json({ results })
}
