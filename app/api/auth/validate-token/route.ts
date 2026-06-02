// GET /api/auth/validate-token?token=… — public preview used by the /register page.
// Returns the invite channel + (for SMS) the pre-fill phone when the token is valid + pending,
// or 404 when it's invalid / expired / already used.

import { NextRequest, NextResponse } from "next/server"
import { getRedeemableInvitation } from "@/lib/invitations"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 })
  }

  try {
    const invite = await getRedeemableInvitation(token)
    if (!invite) {
      return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 404 })
    }
    return NextResponse.json({
      data: {
        valid: true,
        channel: invite.type,
        // Surface only the target relevant to the channel (pre-fills the registration form).
        email: invite.type === "EMAIL" ? invite.target : "",
        phone: invite.type === "SMS" ? invite.target : null,
        expires_at: invite.expires_at,
      },
    })
  } catch (e) {
    console.error("[lyncr] validate-token:", e)
    return NextResponse.json({ error: "Failed to validate invitation" }, { status: 500 })
  }
}
