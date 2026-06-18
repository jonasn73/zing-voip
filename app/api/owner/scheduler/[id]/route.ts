// ============================================
// PATCH /api/owner/scheduler/[id]
// ============================================
// Owner reschedules a job on the calendar (sets ai_leads.scheduled_at).

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { updateLeadScheduledAt } from "@/lib/db"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id: leadId } = await context.params
  if (!leadId?.trim()) return NextResponse.json({ error: "Missing lead id" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { scheduled_at?: string | null }
  const raw = body.scheduled_at
  if (raw == null || String(raw).trim() === "") {
    return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 })
  }
  const parsed = Date.parse(String(raw))
  if (Number.isNaN(parsed)) {
    return NextResponse.json({ error: "scheduled_at must be a valid ISO date" }, { status: 400 })
  }
  const scheduledAt = new Date(parsed).toISOString()

  try {
    const ok = await updateLeadScheduledAt(userId, leadId.trim(), scheduledAt)
    if (!ok) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    return NextResponse.json({ data: { id: leadId, scheduled_at: scheduledAt } })
  } catch (e) {
    console.error("[PATCH /api/owner/scheduler/[id]]", e)
    return NextResponse.json({ error: "Failed to reschedule" }, { status: 500 })
  }
}
