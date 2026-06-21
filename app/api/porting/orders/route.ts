// GET /api/porting/orders — list native LNP port orders for the signed-in owner (optional org filter).

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUser, listPortingOrdersForOwner, countUnreadPortingNotificationsForOrder } from "@/lib/db"
import { isActivePortingOrder } from "@/lib/porting-lifecycle"
import {
  backfillPortingNotificationsFromTelnyxComments,
  backfillPortingExceptionsFromTelnyxOrder,
  syncPortingOrderFromTelnyxLive,
} from "@/lib/porting-telnyx-sync"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user || user.account_role !== "owner") {
    return NextResponse.json({ error: "Only business owners can view port orders" }, { status: 403 })
  }

  const orgId = req.nextUrl.searchParams.get("organization_id")?.trim() || null
  const activeOnly = req.nextUrl.searchParams.get("active") === "1"

  try {
    // Banner + workspace widgets must not leak ports from other businesses.
    if (activeOnly && !orgId) {
      return NextResponse.json({ data: { orders: [] } })
    }

    const orders = await listPortingOrdersForOwner(userId, orgId)
    const filtered = activeOnly ? orders.filter(isActivePortingOrder) : orders

    const syncedOrders = activeOnly
      ? await Promise.all(
          filtered.map(async (order) => {
            const telnyxId = order.telnyx_order_id?.trim()
            if (!telnyxId) return order
            try {
              await backfillPortingExceptionsFromTelnyxOrder({
                ownerUserId: userId,
                telnyxOrderId: telnyxId,
                organizationId: order.organization_id,
              })
              await backfillPortingNotificationsFromTelnyxComments({
                ownerUserId: userId,
                telnyxOrderId: telnyxId,
              })
              return await syncPortingOrderFromTelnyxLive(order)
            } catch (e) {
              console.warn("[GET /api/porting/orders] Telnyx sync:", e)
              return order
            }
          })
        )
      : filtered

    const enriched = await Promise.all(
      syncedOrders.map(async (order) => {
        const telnyxId = order.telnyx_order_id?.trim() || ""
        const unread_notification_count = telnyxId
          ? await countUnreadPortingNotificationsForOrder(userId, telnyxId)
          : 0
        return { ...order, unread_notification_count }
      })
    )
    return NextResponse.json({ data: { orders: enriched } })
  } catch (e) {
    console.error("[GET /api/porting/orders] failed:", e)
    return NextResponse.json({ error: "Could not load port orders" }, { status: 500 })
  }
}
