// ============================================
// GET /api/numbers/porting
// ============================================
// Returns Telnyx port orders with detailed status.
// Deduplicates by phone number — only shows the most recent order per number.
// Also cancels stale drafts to keep things clean.
// When a port completes ("ported"), auto-configures the number with the TeXML
// webhook and adds it to the database so everything works without extra steps.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import {
  getPhoneNumberByNumberAndStatus,
  insertPhoneNumber,
} from "@/lib/db"
import {
  telnyxHeaders,
  getOrCreateTexmlApp,
  configureNumberVoice,
} from "@/lib/telnyx-config"

const TELNYX_BASE = "https://api.telnyx.com/v2"

const STATUS_LABELS: Record<string, string> = {
  draft: "Processing",
  "in-process": "Transfer in progress",
  submitted: "Transfer in progress",
  exception: "Rejected or action needed",
  ported: "Completed",
  cancelled: "Cancelled",
  "cancel-pending": "Cancellation pending",
  "port-activating": "Activating",
  rejected: "Rejected by carrier",
  failed: "Transfer failed",
}

/**
 * Higher = “more final / further along” for picking **one** row per phone number.
 * **Critical:** `draft` must stay **below** `cancelled` / `exception` — otherwise a stale
 * draft order hides the real outcome when Telnyx returns multiple orders per number.
 */
const STATUS_PRIORITY: Record<string, number> = {
  ported: 100,
  "port-activating": 85,
  "in-process": 70,
  submitted: 65,
  exception: 55,
  cancelled: 50,
  "cancel-pending": 45,
  rejected: 52,
  failed: 48,
  draft: 10,
}

const DEFAULT_PRIORITY_UNKNOWN = 30

export async function GET(req: NextRequest) {
  // Get current user so we can save completed ported numbers to their account
  const userId = getUserIdFromRequest(req.headers.get("cookie"))

  try {
    const res = await fetch(
      `${TELNYX_BASE}/porting_orders?page[size]=50&sort=-created_at&include_phone_numbers=true`,
      { headers: telnyxHeaders() }
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

    const allEntries: { id: string; number: string; status: string; statusLabel: string; createdAt: string; customerRef: string }[] = []
    const staleDraftIds: string[] = []

    for (const order of orders) {
      const id = order.id ?? ""
      const rawStatus = String(order.porting_order_status ?? "draft")
        .toLowerCase()
        .trim()
      const statusLabel = STATUS_LABELS[rawStatus] || rawStatus.replace(/-/g, " ")
      const createdAt = order.created_at ?? ""
      const customerRef = order.customer_reference ?? ""
      const numbers: { phone_number?: string }[] = order.phone_numbers ?? []

      for (const p of numbers) {
        const num = p.phone_number ?? ""
        if (num) allEntries.push({ id, number: num, status: rawStatus, statusLabel, createdAt, customerRef })
      }
    }

    const bestPerNumber = new Map<string, (typeof allEntries)[0]>()
    function priorityOf(status: string): number {
      return STATUS_PRIORITY[status] ?? DEFAULT_PRIORITY_UNKNOWN
    }
    function pickBetter(a: (typeof allEntries)[0], b: (typeof allEntries)[0]): (typeof allEntries)[0] {
      const pa = priorityOf(a.status)
      const pb = priorityOf(b.status)
      if (pa !== pb) return pa > pb ? a : b
      const ta = new Date(a.createdAt).getTime()
      const tb = new Date(b.createdAt).getTime()
      return ta >= tb ? a : b
    }
    for (const entry of allEntries) {
      const existing = bestPerNumber.get(entry.number)
      if (!existing) {
        bestPerNumber.set(entry.number, entry)
        continue
      }
      const winner = pickBetter(existing, entry)
      bestPerNumber.set(entry.number, winner)
      const loser = winner.id === existing.id ? entry : existing
      if (loser.status === "draft" && loser.id !== winner.id) {
        staleDraftIds.push(loser.id)
      }
    }

    // Delete stale drafts in background
    if (staleDraftIds.length > 0) {
      const uniqueIds = [...new Set(staleDraftIds)]
      console.log(`[Zing] Deleting ${uniqueIds.length} stale draft port orders`)
      for (const draftId of uniqueIds) {
        fetch(`${TELNYX_BASE}/porting_orders/${draftId}`, {
          method: "DELETE",
          headers: telnyxHeaders(),
        }).catch(() => {})
      }
    }

    // Auto-configure completed ported numbers (runs silently in background)
    const portedNumbers = [...bestPerNumber.values()].filter((e) => e.status === "ported")
    if (portedNumbers.length > 0) {
      // Run in background — don't block the response
      (async () => {
        try {
          const texmlAppId = await getOrCreateTexmlApp()
          for (const entry of portedNumbers) {
            // Figure out which user owns this port from the customer_reference
            const refUserId = entry.customerRef.startsWith("zing-")
              ? entry.customerRef.slice(5)
              : userId // fall back to current user

            if (!refUserId) continue

            // Only add to DB if not already there
            const existing = await getPhoneNumberByNumberAndStatus(entry.number, "active")
            if (!existing) {
              await insertPhoneNumber({
                user_id: refUserId,
                number: entry.number,
                friendly_name: entry.number,
                label: "Ported Line",
                type: "local",
                status: "active",
                provider_number_sid: entry.id,
              })
              console.log(`[Zing] Ported number ${entry.number} added to database for user ${refUserId}`)
            }

            // Configure the number with TeXML webhook
            await configureNumberVoice(entry.number, texmlAppId)
          }
        } catch (err) {
          console.error("[Zing] Auto-configure ported numbers error:", err)
        }
      })()
    }

    // Show cancelled / rejected rows so users see the real outcome (do not hide them
    // and leave a stale draft as the only visible row).
    const list = [...bestPerNumber.values()].map(({ id, number, status, statusLabel, createdAt }) => ({
      id,
      number,
      status,
      statusLabel,
      createdAt,
    }))

    return NextResponse.json({ porting: list })
  } catch (error: unknown) {
    console.error("[Zing] Error listing porting orders:", error)
    return NextResponse.json({ error: "Failed to load porting orders" }, { status: 500 })
  }
}
