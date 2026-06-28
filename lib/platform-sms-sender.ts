// Platform-level outbound SMS sender (admin operator invites, legacy admin SMS invites).
// Never use the logged-in admin user's lines — they may not be on the Telnyx messaging profile.

import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import { listProviderLinkedActiveNumbers, normalizePhoneNumberE164 } from "@/lib/db"
import {
  configureNumberMessaging,
  isTelnyxOwnedNumber,
} from "@/lib/telnyx-messaging-config"

export type PlatformSmsSenderResult =
  | { ok: true; from_e164: string }
  | { ok: false; message: string }

/** Pick the first Telnyx-owned active line usable for platform SMS (not admin-scoped). */
export async function resolvePlatformSmsFromE164(): Promise<PlatformSmsSenderResult> {
  const candidates: string[] = []

  const envFrom = process.env.TELNYX_MESSAGING_FROM_E164?.trim()
  if (envFrom) candidates.push(normalizePhoneNumberE164(envFrom))

  for (const number of await listProviderLinkedActiveNumbers()) {
    const normalized = normalizePhoneNumberE164(number)
    if (!candidates.includes(normalized)) candidates.push(normalized)
  }

  for (const from of candidates) {
    if (!(await isTelnyxOwnedNumber(from))) continue
    try {
      await configureNumberMessaging(from)
    } catch (e) {
      console.warn("[platform-sms] configureNumberMessaging:", from, e)
    }
    return { ok: true, from_e164: from }
  }

  if (candidates.length > 0) {
    return {
      ok: false,
      message: `${formatPhoneDisplay(candidates[0]!)} is not set up for outbound SMS on Telnyx. Open Admin → Dev sandbox and run Repair SMS.`,
    }
  }

  return {
    ok: false,
    message:
      "No Telnyx SMS line is configured yet. Buy a business line in Lyncr or run Repair SMS under Admin → Dev sandbox.",
  }
}
