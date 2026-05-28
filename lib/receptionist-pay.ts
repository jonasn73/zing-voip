// Receptionist payout helpers — duration resolution + FLAT_RATE / PER_MINUTE earnings.

import type { CallLog, Receptionist } from "@/lib/types"

/** How a receptionist is paid for answered inbound legs. */
export type ReceptionistPayMode = "FLAT_RATE" | "PER_MINUTE"

/** Default payout settings when a receptionist row has no overrides. */
export const RECEPTIONIST_PAY_DEFAULTS = {
  pay_mode: "PER_MINUTE" as ReceptionistPayMode,
  rate_per_minute: 0.25,
  flat_rate_usd: 2.5,
}

/** Input for a single payout calculation. */
export type ReceptionistPayInput = {
  /** Talk duration in whole seconds (from answered_at → ended_at when available). */
  durationInSeconds: number
  /** FLAT_RATE pays once per answered call; PER_MINUTE uses duration + rate. */
  payMode: ReceptionistPayMode
  /** Used when payMode is PER_MINUTE (defaults to 0.25). */
  ratePerMinute?: number
  /** Used when payMode is FLAT_RATE (defaults to 2.50). */
  flatRateUsd?: number
  /** When false, payout is zero (missed / unanswered legs). */
  isAnswered: boolean
}

/** Status values that count as a completed / answered receptionist leg. */
const ANSWERED_RECEPTIONIST_STATUSES = new Set([
  "answered",
  "completed",
  "in-progress",
])

/** True when a call log status should earn receptionist pay. */
export function isAnsweredReceptionistCall(status: string): boolean {
  return ANSWERED_RECEPTIONIST_STATUSES.has(String(status ?? "").trim().toLowerCase())
}

/**
 * Resolve talk seconds for a receptionist leg.
 * Prefers (ended_at - answered_at), then falls back to duration_seconds.
 */
export function resolveReceptionistLegDurationSeconds(
  call: Pick<CallLog, "answered_at" | "ended_at" | "duration_seconds">
): number {
  const answeredAt = call.answered_at ? Date.parse(call.answered_at) : NaN
  const endedAt = call.ended_at ? Date.parse(call.ended_at) : NaN
  if (Number.isFinite(answeredAt) && Number.isFinite(endedAt) && endedAt >= answeredAt) {
    return Math.max(0, Math.round((endedAt - answeredAt) / 1000))
  }
  const fallback = Number(call.duration_seconds ?? 0)
  return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 0
}

/** SQL expression (alias `cl`) matching resolveReceptionistLegDurationSeconds in Postgres. */
export const RECEPTIONIST_LEG_DURATION_SQL = `
  GREATEST(0, COALESCE(
    CASE
      WHEN cl.answered_at IS NOT NULL AND cl.ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (cl.ended_at - cl.answered_at))::int
    END,
    cl.duration_seconds,
    0
  ))
`

/** SQL filter (alias `cl`) for answered receptionist legs eligible for pay. */
export const ANSWERED_RECEPTIONIST_STATUS_SQL = `
  lower(cl.status) IN ('answered', 'completed', 'in-progress')
`

/**
 * Calculate payout for one answered receptionist leg.
 * FLAT_RATE → flat amount per answered call.
 * PER_MINUTE → (durationInSeconds / 60) * ratePerMinute.
 */
export function calculateReceptionistPay(input: ReceptionistPayInput): number {
  if (!input.isAnswered) return 0

  if (input.payMode === "FLAT_RATE") {
    const flat = input.flatRateUsd ?? RECEPTIONIST_PAY_DEFAULTS.flat_rate_usd
    return roundUsd(flat)
  }

  const rate = input.ratePerMinute ?? RECEPTIONIST_PAY_DEFAULTS.rate_per_minute
  const minutes = Math.max(0, input.durationInSeconds) / 60
  return roundUsd(minutes * rate)
}

/** Aggregate payout across many answered legs for one receptionist. */
export function calculateReceptionistPayTotal(params: {
  payMode: ReceptionistPayMode
  ratePerMinute?: number
  flatRateUsd?: number
  answeredCalls: number
  totalTalkSeconds: number
}): number {
  if (params.payMode === "FLAT_RATE") {
    const flat = params.flatRateUsd ?? RECEPTIONIST_PAY_DEFAULTS.flat_rate_usd
    return roundUsd(params.answeredCalls * flat)
  }
  const rate = params.ratePerMinute ?? RECEPTIONIST_PAY_DEFAULTS.rate_per_minute
  return roundUsd((Math.max(0, params.totalTalkSeconds) / 60) * rate)
}

/** Pay settings from a receptionist row (with safe defaults). */
export function receptionistPayConfig(receptionist: Pick<
  Receptionist,
  "pay_mode" | "rate_per_minute" | "flat_rate_usd"
>): {
  payMode: ReceptionistPayMode
  ratePerMinute: number
  flatRateUsd: number
} {
  return {
    payMode: receptionist.pay_mode ?? RECEPTIONIST_PAY_DEFAULTS.pay_mode,
    ratePerMinute: receptionist.rate_per_minute ?? RECEPTIONIST_PAY_DEFAULTS.rate_per_minute,
    flatRateUsd: receptionist.flat_rate_usd ?? RECEPTIONIST_PAY_DEFAULTS.flat_rate_usd,
  }
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}
