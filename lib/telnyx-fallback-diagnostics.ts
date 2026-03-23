// ============================================
// Telnyx Dial `action` — optional diagnostic logging
// ============================================
// Set ZING_TELNYX_FALLBACK_DIAGNOSTIC=true on Vercel to log one JSON line per fallback
// request (PII-redacted). Use with fixtures in tests/ to match production behavior.

/** True when extended diagnostic JSON should be logged (in addition to `zing: telnyx-fallback`). */
export function isTelnyxFallbackDiagnosticEnabled(): boolean {
  const v = process.env.ZING_TELNYX_FALLBACK_DIAGNOSTIC
  return v === "1" || v === "true"
}

/** Redact runs of 7+ digits (E.164 chunks, DIDs) — keep last 4 for correlation. Short numbers unchanged. */
export function redactDigitsInString(value: string): string {
  return value.replace(/\d{7,}/g, (d) => `***${d.slice(-4)}`)
}

/** All form keys + redacted values for support / fixtures (never log raw E.164 at full length). */
export function redactDialCallbackFormFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  formData.forEach((raw, key) => {
    const s = String(raw)
    out[key] = redactDigitsInString(s)
  })
  return out
}

/** Snapshot of routing decisions (safe to paste into a new fixture). */
export type TelnyxFallbackDiagnosticSnapshot = {
  userId: string
  callSid: string
  dialStatus: string
  rawDialStatus: string
  dialDurationSec: number
  bridgedToDigits: number
  answeredAndHadConversation: boolean
  pathFallbackMode: string | null
  virtualFbAi: boolean
  inboundFbIntent: string
  primaryWasOwner: boolean
  legHint: string
  businessLineResolved: string
  effectiveBusinessLine: string
  fallbackType: string
  useLive: boolean
  liveFallbackType: string | null
  configFallbackType: string | null
  globalFallbackType: string | null
  hasAssistantId: boolean
}

/**
 * Logs a single JSON line: `zing: telnyx-fallback-diagnostic` when env is set.
 * Includes redacted form fields + decision snapshot so you can compare to tests/fixtures.
 */
export function maybeLogTelnyxFallbackDiagnostic(args: {
  requestUrl: string
  method: string
  formData: FormData
  snapshot: TelnyxFallbackDiagnosticSnapshot
}): void {
  if (!isTelnyxFallbackDiagnosticEnabled()) return
  const pathname = (() => {
    try {
      return new URL(args.requestUrl).pathname
    } catch {
      return args.requestUrl
    }
  })()
  console.log(
    JSON.stringify({
      zing: "telnyx-fallback-diagnostic",
      method: args.method,
      pathname,
      formRedacted: redactDialCallbackFormFields(args.formData),
      snapshot: {
        ...args.snapshot,
        businessLineResolved: redactDigitsInString(args.snapshot.businessLineResolved),
        effectiveBusinessLine: redactDigitsInString(args.snapshot.effectiveBusinessLine),
      },
    })
  )
}
