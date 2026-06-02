// POST /api/admin/invite — admin-only (admin@lyncr.app).
//
// New channel invite:  { target, type: "EMAIL" | "SMS" }
//   → insert into the `invitations` table (native parameterized SQL), 48h expiry, send the
//     /register?token=… link via Resend (email) or Telnyx (SMS).
// Legacy invite:        { email, first_name, payout_rate }
//   → existing team_invites flow redeemed at /signup (kept for the /admin dialog).

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { inviteReceptionist } from "@/app/actions/admin-actions"
import { createInvitation, INVITATION_TTL_MS, type InviteType } from "@/lib/invitations"
import { isReasonablePstnDialString, normalizePhoneNumberE164 } from "@/lib/db"
import { getAppUrl } from "@/lib/telnyx"
import { buildReceptionistInviteEmailPayload, sendReceptionistInviteEmail } from "@/lib/invite-email"
import { sendTelnyxSms } from "@/lib/telnyx-sms"

export async function POST(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    // ---- New channel-based invite (invitations table) -------------------------------------
    if (body.target !== undefined || body.type !== undefined) {
      const type: InviteType = String(body.type ?? "EMAIL").toUpperCase() === "SMS" ? "SMS" : "EMAIL"
      const rawTarget = String(body.target ?? "").trim()
      if (!rawTarget) {
        return NextResponse.json({ error: "A target email or phone number is required" }, { status: 400 })
      }

      // Normalize + validate the target for the chosen channel.
      let target = rawTarget
      if (type === "EMAIL") {
        target = rawTarget.toLowerCase()
        if (!target.includes("@") || target.length < 5) {
          return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
        }
      } else {
        target = normalizePhoneNumberE164(rawTarget)
        if (!isReasonablePstnDialString(target)) {
          return NextResponse.json({ error: "Enter a valid cell phone number" }, { status: 400 })
        }
      }

      // Secure unique token + 48h expiry.
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString()
      const invitation = await createInvitation({ target, type, token, expiresAt })

      const register_url = `${getAppUrl().replace(/\/$/, "")}/register?token=${encodeURIComponent(token)}`

      // ---- Deliver the link over the chosen channel --------------------------------------
      let sent = false
      let send_error: string | undefined
      if (type === "EMAIL") {
        const payload = buildReceptionistInviteEmailPayload({
          toEmail: target,
          firstName: "there",
          signupUrl: register_url,
          payoutRateUsd: 2.5,
        })
        const result = await sendReceptionistInviteEmail(payload)
        sent = result.sent
        send_error = result.error
      } else {
        const result = await sendTelnyxSms({
          toE164: target,
          text: `You're invited to join Lyncr as a receptionist. Create your account (link expires in 48h): ${register_url}`,
          userId: ctx.userId,
        })
        sent = result.ok
        send_error = result.ok ? result.delivery_warning ?? undefined : result.error
      }

      return NextResponse.json({
        data: { invite_id: invitation.id, type, target, register_url, sent, send_error },
      })
    }

    // ---- Legacy email invite (team_invites → /signup) -------------------------------------
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
