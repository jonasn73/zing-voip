// ============================================
// US-focused E.164 helper (callbacks / SMS)
// ============================================
// Turns common US phone inputs into +1… format for Telnyx.

/**
 * Normalize a phone string to E.164 for US numbers when possible.
 * @param raw - Digits or formatted number from a form or carrier
 */
export function toE164(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (trimmed.startsWith("+")) return `+${digits}`
  return `+${digits}`
}
