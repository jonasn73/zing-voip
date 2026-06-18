// Post-call SMS to the admin-routing-override technician after an inbound call ends.

import {
  getCallAdminOverrideDispatchInfo,
  isReasonablePstnDialString,
  normalizePhoneNumberE164,
} from "@/lib/db"
import { sendTelnyxSms } from "@/lib/telnyx-sms"

const TERMINAL_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"])

function formatCallerForSms(fromNumber: string | null): string {
  if (!fromNumber?.trim()) return "Unknown caller"
  const e164 = normalizePhoneNumberE164(fromNumber)
  return e164 || fromNumber.trim()
}

function buildDispatchText(callerNumber: string | null, workspaceName: string): string {
  const caller = formatCallerForSms(callerNumber)
  const workspace = workspaceName.trim() || "your workspace"
  return `Lyncr Dispatch: Lead notification from ${caller} for ${workspace}.`
}

/**
 * After hang-up, text the override technician when the call was routed via admin override.
 * Best-effort and safe to call on every terminal status webhook (Telnyx may retry).
 */
export async function maybeSendAdminOverrideDispatchSms(callSid: string, callStatus: string): Promise<void> {
  const status = callStatus.trim().toLowerCase()
  if (!TERMINAL_STATUSES.has(status)) return

  const info = await getCallAdminOverrideDispatchInfo(callSid)
  if (!info) return

  const technicianE164 = normalizePhoneNumberE164(info.override_phone)
  if (!isReasonablePstnDialString(technicianE164)) return

  const text = buildDispatchText(info.from_number, info.workspace_name)
  const sent = await sendTelnyxSms({ toE164: technicianE164, text, userId: info.user_id })
  if (!sent.ok) {
    console.warn(`[admin-override-dispatch-sms] not sent to ${technicianE164}: ${sent.error}`)
  }
}
