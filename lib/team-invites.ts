// Team invite token helpers.

import { randomBytes } from "crypto"

/** Default invite lifetime — 7 days. */
export const TEAM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Generate a URL-safe random invite token. */
export function generateTeamInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Build the signup URL an invited receptionist should open. */
export function buildTeamInviteSignupUrl(token: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "")
  return `${base}/signup?invite=${encodeURIComponent(token)}`
}
