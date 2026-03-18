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
  exception: "Action needed",
  ported: "Completed",
  cancelled: "Cancelled",
  "cancel-pending": "Cancellation pending",
  "port-activating": "Activating",
}

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
      const rawStatus = order.porting_order_status ?? "draft"
      const statusLabel = STATUS_LABELS[rawStatus] || rawStatus
      const createdAt = order.created_at ?? ""
      const customerRef = order.customer_reference ?? ""
      const numbers: { phone_number?: string }[] = order.phone_numbers ?? []

      for (const p of numbers) {
        const num = p.phone_number ?? ""
        if (num) allEntries.push({ id, number: num, status: rawStatus, statusLabel, createdAt, customerRef })
      }
    }

    const bestPerNumber = new Map<string, typeof allEntries[0]>()
    for (const entry of allEntries) {
      const existing = bestPerNumber.get(entry.number)
      const entryPri = STATUS_PRIORITY[entry.status] ?? 1
      const existingPri = existing ? (STATUS_PRIORITY[existing.status] ?? 1) : -1

      if (!existing || entryPri > existingPri) {
        if (existing && existing.status === "draft" && existing.id !== entry.id) {
          staleDraftIds.push(existing.id)
        }
        bestPerNumber.set(entry.number, entry)
      } else if (entry.status === "draft" && entry.id !== existing.id) {
        staleDraftIds.push(entry.id)
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
                twilio_sid: entry.id,
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

    const list = [...bestPerNumber.values()]
      .filter((e) => e.status !== "cancelled" && e.status !== "cancel-pending")
      .map(({ id, number, status, statusLabel, createdAt }) => ({ id, number, status, statusLabel, createdAt }))

    return NextResponse.json({ porting: list })
  } catch (error: unknown) {
    console.error("[Zing] Error listing porting orders:", error)
    return NextResponse.json({ error: "Failed to load porting orders" }, { status: 500 })
  }
}
