// GET /api/receptionist/training — certification catalog for the signed-in receptionist.

import { NextResponse } from "next/server"
import { getReceptionistPortalContext } from "@/lib/receptionist-portal-auth"
import { getSessionUser } from "@/lib/server-session-user"
import { getTrainingCatalogForUser } from "@/lib/training-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ctx = await getReceptionistPortalContext(user.id)
  if (!ctx) {
    return NextResponse.json({ error: "Receptionist profile not linked" }, { status: 403 })
  }

  const catalog = await getTrainingCatalogForUser(user.id)
  return NextResponse.json({ data: { catalog, user_id: user.id } })
}
