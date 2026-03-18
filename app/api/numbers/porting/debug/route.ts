// Temporary debug endpoint — shows raw Telnyx porting order data + tests delete
import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

const headers = () => ({
  Authorization: `Bearer ${getApiKey()}`,
  "Content-Type": "application/json",
})

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const res = await fetch(
      `${TELNYX_BASE}/porting_orders?page%5Bsize%5D=20&sort=-created_at&include_phone_numbers=true`,
      { headers: headers() }
    )
    const body = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: "Telnyx error", status: res.status, body })
    }

    const orders = (body?.data || []).map((o: Record<string, unknown>) => ({
      id: o.id,
      status: o.porting_order_status,
      created_at: o.created_at,
      phone_numbers: (o.phone_numbers as Array<Record<string, unknown>> || []).map(
        (p) => p.phone_number
      ),
      requirements_status: o.requirements_status,
      documents: o.documents,
    }))

    return NextResponse.json({ count: orders.length, orders })
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { order_id, action } = await req.json()
  if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 })

  const results: Record<string, unknown> = { order_id }

  // Try DELETE
  const delRes = await fetch(`${TELNYX_BASE}/porting_orders/${order_id}`, {
    method: "DELETE",
    headers: headers(),
  })
  const delBody = delRes.status !== 204 ? await delRes.json().catch(() => null) : null
  results.delete_status = delRes.status
  results.delete_body = delBody

  // If delete failed, try cancel
  if (!delRes.ok && delRes.status !== 204) {
    const cancelRes = await fetch(`${TELNYX_BASE}/porting_orders/${order_id}/actions/cancel`, {
      method: "POST",
      headers: headers(),
    })
    const cancelBody = await cancelRes.json().catch(() => null)
    results.cancel_status = cancelRes.status
    results.cancel_body = cancelBody
  }

  return NextResponse.json(results)
}
