// ============================================
// GET /api/numbers/porting
// ============================================
// Returns Telnyx port orders with detailed status so the Settings page can show real progress.

import { NextResponse } from "next/server"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

// Human-friendly status labels that avoid mentioning Telnyx
const STATUS_LABELS: Record<string, string> = {
  draft: "Processing",
  "in-process": "Transfer in progress",
  submitted: "Transfer in progress",
  "exception": "Action needed",
  "ported": "Completed",
  "cancelled": "Cancelled",
  "cancel-pending": "Cancellation pending",
  "port-activating": "Activating",
}

export async function GET() {
  try {
    const res = await fetch(`${TELNYX_BASE}/porting_orders?page[size]=50&sort=-created_at&include_phone_numbers=true`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const errMsg = body?.errors?.[0]?.detail || `HTTP ${res.status}`

      if (res.status === 403 || /feature not permitted|10038/i.test(errMsg)) {
        return NextResponse.json({ porting: [], message: "Porting not available on your current plan." }, { status: 200 })
      }
      throw new Error(errMsg)
    }

    const body = await res.json()
    const orders = body?.data || []

    const list: { id: string; number: string; status: string; statusLabel: string; createdAt: string }[] = []

    for (const order of orders) {
      const id = order.id ?? ""
      const rawStatus = order.porting_order_status ?? "draft"
      const statusLabel = STATUS_LABELS[rawStatus] || rawStatus
      const createdAt = order.created_at ?? ""
      const numbers: { phone_number?: string }[] = order.phone_numbers ?? []

      for (const p of numbers) {
        const num = p.phone_number ?? ""
        if (num) list.push({ id, number: num, status: rawStatus, statusLabel, createdAt })
      }
    }

    return NextResponse.json({ porting: list })
  } catch (error: unknown) {
    console.error("[Zing] Error listing porting orders:", error)
    return NextResponse.json({ error: "Failed to load porting orders" }, { status: 500 })
  }
}
