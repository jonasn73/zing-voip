// GET /api/porting/orders — list native LNP port orders for the signed-in owner (optional org filter).

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUser, listPortingOrdersForOwner } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user || user.account_role !== "owner") {
    return NextResponse.json({ error: "Only business owners can view port orders" }, { status: 403 })
  }

  const orgId = req.nextUrl.searchParams.get("organization_id")?.trim() || null

  try {
    const orders = await listPortingOrdersForOwner(userId, orgId)
    return NextResponse.json({ data: { orders } })
  } catch (e) {
    console.error("[GET /api/porting/orders] failed:", e)
    return NextResponse.json({ error: "Could not load port orders" }, { status: 500 })
  }
}
