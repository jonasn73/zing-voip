// Account status values for onboarding_profiles.account_status (admin overrides + voice routing guard).

export const ACCOUNT_STATUSES = ["active", "suspended", "flagged"] as const

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export function parseAccountStatus(value: unknown): AccountStatus | null {
  const s = String(value ?? "").trim().toLowerCase()
  if (s === "active" || s === "suspended" || s === "flagged") return s
  return null
}

/** Spoken when account_status is suspended — inbound Telnyx webhooks must return this and hang up. */
export const SUSPENDED_LINE_TEXML_MESSAGE = "This line is temporarily unavailable."

export function isAccountRoutingBlocked(status: string | null | undefined): boolean {
  return parseAccountStatus(status) === "suspended"
}

export function accountStatusLabel(status: string): string {
  const parsed = parseAccountStatus(status)
  if (parsed === "suspended") return "Suspended"
  if (parsed === "flagged") return "Flagged"
  return "Active"
}
