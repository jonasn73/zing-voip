// Pure helpers for the field-tech SMS invite flow (safe to import on both client and server —
// no Node-only or database imports here).

import { toE164 } from "@/lib/phone-e164"

/** Invited techs have 48h to finish setup before the token expires. */
export const TECH_INVITE_TTL_MS = 48 * 60 * 60 * 1000

/**
 * Deterministic login email for a field tech derived from their mobile number. Techs are invited by
 * phone (no email field), so we synthesize a stable login address from the E.164 digits. The tech
 * never types this — they log in by entering their mobile number, which we convert with this same fn.
 */
export function syntheticTechEmail(phone: string): string {
  const digits = toE164(phone).replace(/\D/g, "")
  return `t${digits}@tech.lyncr.app`
}

/** Build the white-labeled setup link the tech taps from their SMS. */
export function buildTechSetupUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "")
  return `${base}/tech/setup?token=${encodeURIComponent(token)}`
}

/** The exact invite SMS copy (white-labeled Lyncr). */
export function techInviteSmsText(businessName: string, setupUrl: string): string {
  const biz = businessName?.trim() || "Your team"
  return `Welcome to Lyncr! ${biz} has added you as a field technician. Click here to set up your secure password and access your mobile console: ${setupUrl}`
}
