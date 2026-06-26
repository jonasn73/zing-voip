// Parse talk-time seconds from Telnyx TeXML / status webhook form fields.

const DURATION_FIELD_KEYS = [
  "CallDuration",
  "call_duration",
  "Duration",
  "DialCallDuration",
  "DialCallDurationSeconds",
  "DialBridgedDuration",
  "DialDuration",
  "BridgeDuration",
  "BridgedDuration",
] as const

/** Normalize a raw duration string to whole seconds (Telnyx may send ms on some builds). */
export function normalizeTelnyxDurationSeconds(raw: string | null | undefined): number {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) return 0
  let n = parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 600) n = Math.round(n / 1000)
  return n
}

/** Best talk-time seconds from a Telnyx webhook form body. */
export function parseTelnyxTalkSecondsFromForm(formData: FormData): number {
  let best = 0
  for (const key of DURATION_FIELD_KEYS) {
    const value = formData.get(key)
    if (value == null) continue
    best = Math.max(best, normalizeTelnyxDurationSeconds(String(value)))
  }
  return best
}
