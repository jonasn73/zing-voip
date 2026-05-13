// ============================================
// Inbound line identification (voice)
// ============================================
// Short phrase played only to the receptionist / owner leg before the caller
// is bridged, so they know which business number was dialed.

/** Strip characters that could break TeXML / SSML; keep letters, numbers, common punctuation. */
export function sanitizeWhisperPhrase(raw: string): string {
  const trimmed = raw.normalize("NFKC").trim().slice(0, 96)
  return trimmed.replace(/[^\p{L}\p{N}\s\-().,'&]/gu, " ").replace(/\s+/g, " ").trim()
}

/**
 * Builds a speakable line-ID phrase from `phone_numbers.label` / `friendly_name`.
 * Prefer a custom label (e.g. "Key Squad 502") over the default "Main Line".
 */
export function buildInboundLineWhisperPhrase(
  phoneLineLabel: string,
  phoneLineFriendlyName: string,
  businessLineE164: string
): string {
  const lbl = phoneLineLabel.trim()
  if (lbl && lbl.toLowerCase() !== "main line") {
    return sanitizeWhisperPhrase(`Zing. ${lbl}.`)
  }
  const fn = phoneLineFriendlyName.trim()
  if (fn) {
    return sanitizeWhisperPhrase(`Zing. Call for ${fn}.`)
  }
  const digits = businessLineE164.replace(/\D/g, "")
  const last4 = digits.slice(-4)
  if (last4.length === 4) {
    return sanitizeWhisperPhrase(`Zing. Business line, ending ${last4.split("").join(" ")}.`)
  }
  return "Zing. Incoming business call."
}
