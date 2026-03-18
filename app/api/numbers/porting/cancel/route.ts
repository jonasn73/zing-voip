// ============================================
// POST /api/numbers/porting/cancel
// ============================================
// Cancels a porting order by ID.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const orderId = body?.order_id

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 })
    }

    const res = await fetch(`${TELNYX_BASE}/porting_orders/${orderId}/actions/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const errMsg = errBody?.errors?.[0]?.detail || `HTTP ${res.status}`
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("[Zing] Cancel port error:", error)
    return NextResponse.json({ error: "Failed to cancel port order" }, { status: 500 })
  }
}
