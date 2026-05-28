// GET /api/admin/sandbox/intake-logs — latest ai_leads intake rows for the sandbox workspace.

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { listSandboxIntakeLogs } from "@/lib/sandbox-engine"

export async function GET(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx

  const limitParam = req.nextUrl.searchParams.get("limit")
  const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 25, 1), 100) : 25

  try {
    const rows = await listSandboxIntakeLogs(limit)
    return NextResponse.json({ data: rows })
  } catch (e) {
    console.error("[lyncr-admin] sandbox intake-logs:", e)
    return NextResponse.json({ error: "Failed to load intake logs" }, { status: 500 })
  }
}
