// Builds the `<Number url="…">` document URL that Telnyx fetches when a
// receptionist's cell phone answers. Encodes who answered + which call so the
// answer webhook can broadcast a precise real-time event to their HUD.

import type { ReceptionistBusinessType } from "@/lib/business-type"

export function buildReceptionistAnswerUrl(params: {
  appUrl: string
  receptionistId: string
  callSid: string
  businessType: ReceptionistBusinessType
  callerNumber?: string | null
  callerName?: string | null
  businessName?: string | null
  /** Optional whisper phrase spoken to the receptionist on answer. */
  whisper?: string | null
}): string {
  const base = params.appUrl.replace(/\/+$/, "")
  const qs = new URLSearchParams()
  qs.set("r", params.receptionistId)
  if (params.callSid) qs.set("cl", params.callSid)
  qs.set("bt", params.businessType)
  if (params.callerNumber) qs.set("from", params.callerNumber)
  if (params.callerName) qs.set("cn", params.callerName)
  if (params.businessName) qs.set("bn", params.businessName)
  if (params.whisper) qs.set("p", params.whisper)
  return `${base}/api/voice/telnyx/receptionist-answer?${qs.toString()}`
}
