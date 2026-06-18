// Helpers for parsing appointment times from receptionist intake fields.

/** Try to parse a structured ISO time from intake field values. */
export function parseScheduledAtFromFields(fields: Record<string, unknown>): string | null {
  const raw =
    fields.scheduled_at ??
    fields.preferred_time ??
    fields.time_slot ??
    fields.appointment_time ??
    fields.drop_off_time
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}

/** Normalize a date-only or ISO string for API query params. */
export function parseIsoDateParam(raw: string | null | undefined): Date | null {
  const text = raw?.trim()
  if (!text) return null
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Start/end of calendar month in ISO for DB range queries. */
export function monthRangeUtc(year: number, monthIndex: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
  const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Calendar day key (YYYY-MM-DD) in local timezone. */
export function dayKeyLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
