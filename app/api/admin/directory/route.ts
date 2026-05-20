// GET /api/admin/directory — all users for the operator table (admin@lyncr.app only).

import { NextRequest, NextResponse } from "next/server"
import { requireLyncrAdmin } from "@/lib/admin-api-guard"
import { listLyncrAdminDirectory } from "@/lib/db"

export async function GET(req: NextRequest) {
  const ctx = await requireLyncrAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  try {
    const users = await listLyncrAdminDirectory()
    return NextResponse.json({ data: { users } })
  } catch (e) {
    console.error("[lyncr-admin] directory:", e)
    return NextResponse.json({ error: "Failed to load user directory" }, { status: 500 })
  }
}
