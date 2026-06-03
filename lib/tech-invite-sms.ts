// White-labeled Lyncr SMS that delivers a tech's secure /tech/setup link.

import { sendTelnyxSms } from "@/lib/telnyx-sms"
import { toE164 } from "@/lib/phone-e164"
import { buildTechSetupUrl, techInviteSmsText } from "@/lib/tech-invite"

export type TechInviteSmsResult = { sent: boolean; error: string | null; setupUrl: string }

/** Resolve the public base URL for building the setup link (env first, request origin fallback). */
export function resolveAppBaseUrl(reqOrigin?: string | null): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/+$/, "")
  if (reqOrigin) return reqOrigin.replace(/\/+$/, "")
  return "https://lyncr.app"
}

/** Text a field tech their secure password-setup link. Never throws — returns a status object. */
export async function sendTechInviteSms(params: {
  ownerUserId: string
  toPhone: string
  businessName: string
  token: string
  baseUrl: string
}): Promise<TechInviteSmsResult> {
  const setupUrl = buildTechSetupUrl(params.baseUrl, params.token)
  try {
    const res = await sendTelnyxSms({
      toE164: toE164(params.toPhone),
      text: techInviteSmsText(params.businessName, setupUrl),
      userId: params.ownerUserId,
    })
    if (res.ok) return { sent: true, error: res.delivery_warning, setupUrl }
    return { sent: false, error: res.error, setupUrl }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "SMS failed", setupUrl }
  }
}
