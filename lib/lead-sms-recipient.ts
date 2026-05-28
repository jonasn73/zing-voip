// Resolve which E.164 number receives instant lead alert SMS.

import type { OnboardingProfile, User } from "@/lib/types"
import { isReasonablePstnDialString, normalizePhoneNumberE164 } from "@/lib/db"

function toDialableE164(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) return null
  const e164 = normalizePhoneNumberE164(trimmed)
  return isReasonablePstnDialString(e164) ? e164 : null
}

/** dispatch_sms_phone → notification_phone → users.phone (primary profile phone). */
export function resolveLeadAlertSmsRecipient(
  profile: Pick<OnboardingProfile, "dispatch_sms_phone" | "notification_phone"> | null,
  user: Pick<User, "phone"> | null
): string | null {
  const targetSmsNumber =
    toDialableE164(profile?.dispatch_sms_phone) ||
    toDialableE164(profile?.notification_phone) ||
    toDialableE164(user?.phone)
  return targetSmsNumber
}
