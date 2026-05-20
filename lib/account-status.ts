// Account status values for onboarding_profiles.account_status (admin overrides + voice routing guard).

export const ACCOUNT_STATUSES = ["active", "suspended", "flagged"] as const

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export function parseAccountStatus(value: unknown): AccountStatus | null {
  const s = String(value ?? "").trim().toLowerCase()
  if (s === "active" || s === "suspended" || s === "flagged") return s
  return null
}

/** Suspended accounts are blocked from Telnyx inbound/outbound routing webhooks. */
export function isAccountRoutingBlocked(status: string | null | undefined): boolean {
  return parseAccountStatus(status) === "suspended"
}

export function accountStatusLabel(status: string): string {
  const parsed = parseAccountStatus(status)
  if (parsed === "suspended") return "Suspended"
  if (parsed === "flagged") return "Flagged"
  return "Active"
}
