// ============================================
// POST /api/admin/notify-dispatch
// ============================================
// Backend trigger that texts the business owner a formatted job dispatch (business, customer, phone,
// operator notes + a tappable maps link). Normally fired internally right after a wrap-up finishes
// (the voice wrap-up calls sendOwnerDispatchSms directly), but exposed here so it can be triggered
// explicitly or re-sent.
//
// Protect with LYNCR_INTERNAL_DISPATCH_SECRET (sent as the `x-lyncr-internal` header) when set.

import { NextRequest, NextResponse } from "next/server"
import { sendOwnerDispatchSms } from "@/lib/owner-dispatch-sms"

export const runtime = "nodejs"

type DispatchBody = {
  userId?: string
  callSid?: string | null
  customerName?: string | null
  customerPhone?: string | null
  location?: string | null
  notes?: string | null
}

export async function POST(req: NextRequest) {
  const secret = process.env.LYNCR_INTERNAL_DISPATCH_SECRET?.trim()
  if (secret) {
    const provided = req.headers.get("x-lyncr-internal")?.trim()
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const body = (await req.json().catch(() => ({}))) as DispatchBody
  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  try {
    const result = await sendOwnerDispatchSms({
      userId,
      callSid: body.callSid ?? null,
      customerName: body.customerName ?? null,
      customerPhone: body.customerPhone ?? null,
      location: body.location ?? null,
      notes: body.notes ?? null,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 })
    }
    return NextResponse.json({ data: { sent: true, to: result.to } })
  } catch (e) {
    console.error("[admin/notify-dispatch]", e)
    return NextResponse.json({ error: "Failed to send dispatch" }, { status: 500 })
  }
}
