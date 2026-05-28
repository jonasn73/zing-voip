// POST /api/admin/invite — delegates to inviteReceptionist server action.

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { inviteReceptionist } from "@/app/actions/admin-actions"

export async function POST(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = (await req.json()) as Record<string, unknown>
    const email = String(body.email ?? "").trim()
    const name = String(body.first_name ?? body.firstName ?? body.name ?? "").trim()
    const baseRate = Number(body.payout_rate ?? body.payoutRate ?? body.baseRate ?? 2.5)

    const result = await inviteReceptionist(email, name, baseRate)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      data: {
        invite_id: result.invite_id,
        email: result.email,
        signup_url: result.signup_url,
        email_sent: result.email_sent,
        email_error: result.email_error,
      },
    })
  } catch (e) {
    console.error("[lyncr-admin] invite:", e)
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })
  }
}
