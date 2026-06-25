// Client-safe carrier-live check (no server/db imports).

/** True when Telnyx owns the DID and the line is active — calls can route. */
export function isPhoneNumberCarrierLive(row: {
  provider_number_sid?: string | null
  status: string
}): boolean {
  return Boolean(row.provider_number_sid?.trim()) && row.status === "active"
}
