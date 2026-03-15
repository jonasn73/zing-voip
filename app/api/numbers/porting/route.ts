// ============================================
// GET /api/numbers/porting
// ============================================
// Returns your Telnyx port orders so the dashboard can show "Porting" numbers and progress.

import { NextResponse } from "next/server"
import { getTelnyxClient } from "@/lib/telnyx"

export async function GET() {
  try {
    const client = getTelnyxClient()
    const list: { id: string; number: string; status: string }[] = []

    for await (const order of client.portingOrders.list({ include_phone_numbers: true })) {
      const o = order as { id?: string; porting_order_status?: string; phone_numbers?: { phone_number?: string }[] }
      const id = o.id ?? ""
      const status = o.porting_order_status ?? "draft"
      const numbers = o.phone_numbers ?? []
      for (const p of numbers) {
        const num = p.phone_number ?? ""
        if (num) list.push({ id, number: num, status })
      }
    }

    return NextResponse.json({ porting: list })
  } catch (error) {
    console.error("[Zing] Error listing porting orders:", error)
    return NextResponse.json(
      { error: "Failed to load porting orders" },
      { status: 500 }
    )
  }
}
