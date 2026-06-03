// ============================================
// GET/PUT /api/settings/email-recordings
// ============================================
// "Email Call Recordings" dispatch-alert toggle — when on, the owner is emailed mp3 playback links
// for completed operator calls. Stored on onboarding_profiles.email_recordings_enabled (scripts/056),
// read/written defensively so a pre-migration deploy stays safe.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getEmailRecordingsEnabled, setEmailRecordingsEnabled } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const enabled = await getEmailRecordingsEnabled(userId)
    return NextResponse.json({ data: { email_recordings_enabled: enabled } })
  } catch (e) {
    console.error("[settings/email-recordings GET]", e)
    return NextResponse.json({ error: "Failed to load preference" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const enabled = body.email_recordings_enabled === true
    const saved = await setEmailRecordingsEnabled(userId, enabled)
    return NextResponse.json({ data: { email_recordings_enabled: saved } })
  } catch (e) {
    console.error("[settings/email-recordings PUT]", e)
    const msg = e instanceof Error ? e.message : "Failed to save preference"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
