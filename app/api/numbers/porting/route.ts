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
  } catch (error: unknown) {
    console.error("[Zing] Error listing porting orders:", error)
    const err = error as { statusCode?: number; body?: { errors?: Array<{ code?: string }> }; message?: string }
    const msg = String(error instanceof Error ? (error as Error).message : error)
    if (
      err.statusCode === 403 ||
      err.body?.errors?.some((e) => e.code === "10038") ||
      /10038|feature not permitted|not permitted at this account/i.test(msg)
    ) {
      return NextResponse.json(
        { porting: [], message: "Porting not available on your Telnyx plan. Upgrade at telnyx.com/upgrade." },
        { status: 200 }
      )
    }
    return NextResponse.json(
      { error: "Failed to load porting orders" },
      { status: 500 }
    )
  }
}
