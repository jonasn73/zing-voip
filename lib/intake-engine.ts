// Call intake engine — persist AI leads and dispatch optional owner SMS alerts.

import {
  getOnboardingProfile,
  getUser,
  insertAiLead,
  updateAiLeadSmsOutcome,
} from "@/lib/db"
import { buildLeadAlertSmsText } from "@/lib/lead-sms-alert"
import { resolveLeadAlertSmsRecipient } from "@/lib/lead-sms-recipient"
import { sendTelnyxSms } from "@/lib/telnyx-sms"

export type SaveCallIntakeParams = {
  user_id: string
  caller_e164: string | null
  intent_slug: string | null
  collected: Record<string, unknown>
  summary: string | null
  vapi_call_id: string | null
}

export type SaveCallIntakeResult = {
  id: string
  sms_sent: boolean
  sms_error: string | null
}

async function maybeDispatchLeadSmsAlert(params: {
  userId: string
  leadId: string
  caller_e164: string | null
  intent_slug: string | null
  collected: Record<string, unknown>
  summary: string | null
}): Promise<{ sms_sent: boolean; sms_error: string | null }> {
  const [profile, user] = await Promise.all([
    getOnboardingProfile(params.userId),
    getUser(params.userId),
  ])

  if (!profile?.sms_leads_enabled) {
    return { sms_sent: false, sms_error: null }
  }

  const targetSmsNumber = resolveLeadAlertSmsRecipient(profile, user)
  if (!targetSmsNumber) {
    return { sms_sent: false, sms_error: "No dispatch or profile phone configured for SMS alerts" }
  }

  const text = buildLeadAlertSmsText({
    businessName: user?.business_name?.trim() || user?.name?.trim() || "Your business",
    callerE164: params.caller_e164,
    intentSlug: params.intent_slug,
    collected: params.collected,
    summary: params.summary,
  })

  const sent = await sendTelnyxSms({ toE164: targetSmsNumber, text })
  if (sent.ok) {
    return { sms_sent: true, sms_error: null }
  }
  return { sms_sent: false, sms_error: sent.error }
}

/**
 * Save an AI intake lead, then optionally text the owner when SMS alerts are enabled.
 */
export async function saveCallIntake(params: SaveCallIntakeParams): Promise<SaveCallIntakeResult> {
  const leadId = await insertAiLead({
    user_id: params.user_id,
    caller_e164: params.caller_e164,
    intent_slug: params.intent_slug,
    collected: params.collected,
    summary: params.summary,
    sms_sent: false,
    sms_error: null,
    vapi_call_id: params.vapi_call_id,
  })

  const smsOutcome = await maybeDispatchLeadSmsAlert({
    userId: params.user_id,
    leadId,
    caller_e164: params.caller_e164,
    intent_slug: params.intent_slug,
    collected: params.collected,
    summary: params.summary,
  })

  if (smsOutcome.sms_sent || smsOutcome.sms_error) {
    await updateAiLeadSmsOutcome(leadId, smsOutcome)
  }

  return {
    id: leadId,
    sms_sent: smsOutcome.sms_sent,
    sms_error: smsOutcome.sms_error,
  }
}
