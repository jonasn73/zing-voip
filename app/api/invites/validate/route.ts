// GET /api/invites/validate?token= — public preview for signup page.

import { NextRequest, NextResponse } from "next/server"
import { getTeamInvitePreview } from "@/lib/db"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 })
  }

  try {
    const preview = await getTeamInvitePreview(token)
    if (!preview) {
      return NextResponse.json({ error: "Invite invalid or expired" }, { status: 404 })
    }
    return NextResponse.json({ data: preview })
  } catch (e) {
    console.error("[lyncr] invite validate:", e)
    return NextResponse.json({ error: "Failed to validate invite" }, { status: 500 })
  }
}
