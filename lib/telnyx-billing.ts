import { telnyxHeaders } from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export type TelnyxBalanceSnapshot = {
  balance_usd: number
  available_credit_usd: number
  credit_limit_usd: number
  currency: string
}

function parseUsd(value: unknown): number {
  const n = Number(String(value ?? "0").replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Read the platform Telnyx account balance (shared carrier wallet). */
export async function getTelnyxAccountBalance(): Promise<TelnyxBalanceSnapshot> {
  const res = await fetch(`${TELNYX_BASE}/balance`, { headers: telnyxHeaders() })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      (body as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ||
      "Could not read Telnyx balance"
    throw new Error(String(err))
  }
  const data = (body as { data?: Record<string, unknown> })?.data ?? {}
  return {
    balance_usd: parseUsd(data.balance),
    available_credit_usd: parseUsd(data.available_credit),
    credit_limit_usd: parseUsd(data.credit_limit),
    currency: String(data.currency ?? "USD"),
  }
}

/** After a user buys carrier credit, ensure Telnyx auto-recharge can cover number purchases. */
export async function syncTelnyxCarrierWalletAfterCreditPurchase(
  purchasedUsd: number
): Promise<{ ok: boolean; message: string; balance?: TelnyxBalanceSnapshot }> {
  const minAvailable = Math.max(5, purchasedUsd)
  let balance: TelnyxBalanceSnapshot
  try {
    balance = await getTelnyxAccountBalance()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Telnyx balance unavailable"
    return { ok: false, message: msg }
  }

  if (balance.available_credit_usd >= minAvailable) {
    return {
      ok: true,
      message: `Telnyx carrier wallet has $${balance.available_credit_usd.toFixed(2)} available.`,
      balance,
    }
  }

  const prefsRes = await fetch(`${TELNYX_BASE}/payments/auto_recharge_prefs`, {
    headers: telnyxHeaders(),
  })
  const prefsBody = await prefsRes.json().catch(() => ({}))
  const prefs = (prefsBody as { data?: Record<string, unknown> })?.data

  if (prefs?.enabled === true) {
    return {
      ok: true,
      message:
        "Telnyx auto-recharge is enabled — your carrier wallet will refill from the payment method on file in Telnyx Mission Control.",
      balance,
    }
  }

  return {
    ok: false,
    message:
      "Add a payment method in Telnyx Mission Control → Billing and enable auto-recharge so purchased credit can fund phone numbers automatically.",
    balance,
  }
}
