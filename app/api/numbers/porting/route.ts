// ============================================
// GET /api/numbers/porting
// ============================================
// Returns Telnyx port orders with detailed status.
// Deduplicates by phone number — only shows the most recent order per number.
// Also cancels stale drafts to keep things clean.

import { NextResponse } from "next/server"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Processing",
  "in-process": "Transfer in progress",
  submitted: "Transfer in progress",
  exception: "Action needed",
  ported: "Completed",
  cancelled: "Cancelled",
  "cancel-pending": "Cancellation pending",
  "port-activating": "Activating",
}

// Priority: higher = more important to show (keeps the most advanced order per number)
const STATUS_PRIORITY: Record<string, number> = {
  ported: 6,
  "port-activating": 5,
  "in-process": 4,
  submitted: 3,
  exception: 2,
  draft: 1,
  cancelled: 0,
  "cancel-pending": 0,
}

export async function GET() {
  try {
    const res = await fetch(
      `${TELNYX_BASE}/porting_orders?page[size]=50&sort=-created_at&include_phone_numbers=true`,
      {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
      }
    )

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

    // Collect all entries, then deduplicate per phone number (keep highest-priority order)
    const allEntries: { id: string; number: string; status: string; statusLabel: string; createdAt: string }[] = []
    const staleDraftIds: string[] = []

    for (const order of orders) {
      const id = order.id ?? ""
      const rawStatus = order.porting_order_status ?? "draft"
      const statusLabel = STATUS_LABELS[rawStatus] || rawStatus
      const createdAt = order.created_at ?? ""
      const numbers: { phone_number?: string }[] = order.phone_numbers ?? []

      for (const p of numbers) {
        const num = p.phone_number ?? ""
        if (num) allEntries.push({ id, number: num, status: rawStatus, statusLabel, createdAt })
      }
    }

    // Deduplicate: keep the most advanced (highest priority) order per phone number
    const bestPerNumber = new Map<string, typeof allEntries[0]>()
    for (const entry of allEntries) {
      const existing = bestPerNumber.get(entry.number)
      const entryPri = STATUS_PRIORITY[entry.status] ?? 1
      const existingPri = existing ? (STATUS_PRIORITY[existing.status] ?? 1) : -1

      if (!existing || entryPri > existingPri) {
        // If we're replacing a draft with something better, mark old one as stale
        if (existing && existing.status === "draft" && existing.id !== entry.id) {
          staleDraftIds.push(existing.id)
        }
        bestPerNumber.set(entry.number, entry)
      } else if (entry.status === "draft" && entry.id !== existing.id) {
        staleDraftIds.push(entry.id)
      }
    }

    // Cancel stale drafts in background (don't block the response)
    if (staleDraftIds.length > 0) {
      const uniqueIds = [...new Set(staleDraftIds)]
      console.log(`[Zing] Cancelling ${uniqueIds.length} stale draft port orders`)
      for (const draftId of uniqueIds) {
        fetch(`${TELNYX_BASE}/porting_orders/${draftId}/actions/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json" },
        }).catch(() => {})
      }
    }

    // Filter out cancelled orders from the display
    const list = [...bestPerNumber.values()].filter(
      (e) => e.status !== "cancelled" && e.status !== "cancel-pending"
    )

    return NextResponse.json({ porting: list })
  } catch (error: unknown) {
    console.error("[Zing] Error listing porting orders:", error)
    return NextResponse.json({ error: "Failed to load porting orders" }, { status: 500 })
  }
}
