/** True when value looks like a Postgres UUID (raw id leaked into UI). */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function normalizeE164(phone: string): string {
  const d = digitsOnly(phone)
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith("1")) return `+${d}`
  if (phone.startsWith("+")) return phone
  return phone
}

export function formatPhoneDisplay(phone: string | undefined | null): string {
  const v = String(phone || "")
  if (!v) return "Unknown"
  const digits = digitsOnly(v)
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return v
}

export type LineLabelEntry = { number: string; label: string }

/** Map E.164 (+ variants) → display label from owned business numbers. */
export function buildBusinessLineLabelMap(numbers: LineLabelEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of numbers) {
    const num = row.number?.trim()
    if (!num) continue
    const label = row.label?.trim() || "Business Line"
    map.set(num, label)
    map.set(normalizeE164(num), label)
    const d = digitsOnly(num)
    if (d.length >= 10) map.set(d, label)
  }
  return map
}

export function resolveBusinessLineLabel(
  toNumber: string | null | undefined,
  labelMap: Map<string, string>
): string {
  const raw = String(toNumber || "").trim()
  if (!raw) return "Business Line"
  if (isUuid(raw)) return "Business Line"
  const fromMap =
    labelMap.get(raw) ??
    labelMap.get(normalizeE164(raw)) ??
    labelMap.get(digitsOnly(raw))
  if (fromMap) return fromMap
  if (raw.startsWith("+") || digitsOnly(raw).length >= 10) return formatPhoneDisplay(raw)
  return raw
}

export function resolveRoutedPartyLabel(
  routedName: string | null | undefined,
  receptionistId: string | null | undefined,
  receptionistNames: Map<string, string>
): string {
  const name = String(routedName || "").trim()
  if (name && !isUuid(name)) return name
  const id = String(receptionistId || "").trim()
  if (id && receptionistNames.has(id)) return receptionistNames.get(id)!
  if (name && isUuid(name) && receptionistNames.has(name)) return receptionistNames.get(name)!
  if (/^owner$/i.test(name)) return "Your phone"
  if (/ai|assistant|voice/i.test(name)) return "AI Receptionist"
  return "Your phone"
}
