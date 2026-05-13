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
  const lbl = phoneLineLabel.trim() // Trim spaces from the dashboard line name
  if (lbl && lbl.toLowerCase() !== "main line") {
    // Custom name wins: speak only that text (no “Zing” or “call for” wrapper)
    return sanitizeWhisperPhrase(lbl)
  }
  const fn = phoneLineFriendlyName.trim() // Often the formatted business number when label is default
  if (fn) {
    // Second choice: the friendly display string only
    return sanitizeWhisperPhrase(fn)
  }
  const digits = businessLineE164.replace(/\D/g, "") // Strip + and punctuation from E.164
  const last4 = digits.slice(-4) // Last four of the DID the caller dialed
  if (last4.length === 4) {
    // Space between digits so TTS reads them as separate numbers, not one big integer
    return sanitizeWhisperPhrase(last4.split("").join(" "))
  }
  return "Incoming call" // Fallback when we have no usable digits
}
