// ============================================
// GET/PUT /api/routing
// ============================================
// Get or update call routing configuration. Protected: requires session.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getRoutingConfig, updateRoutingConfig, getReceptionists } from "@/lib/db"
import type { UpdateRoutingRequest } from "@/lib/types"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const [config, receptionists] = await Promise.all([
      getRoutingConfig(userId),
      getReceptionists(userId),
    ])

    return NextResponse.json({
      config,
      receptionists,
    })
  } catch (error) {
    console.error("[Zing] Error fetching routing config:", error)
    return NextResponse.json(
      { error: "Failed to fetch routing config" },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  try {
    const body: UpdateRoutingRequest = await req.json()

    await updateRoutingConfig(userId, {
      selected_receptionist_id: body.selected_receptionist_id,
      fallback_type: body.fallback_type,
      ai_greeting: body.ai_greeting,
      ring_timeout_seconds: body.ring_timeout_seconds,
    })

    const updated = await getRoutingConfig(userId)
    return NextResponse.json({ config: updated })
  } catch (error) {
    console.error("[Zing] Error updating routing config:", error)
    return NextResponse.json(
      { error: "Failed to update routing config" },
      { status: 500 }
    )
  }
}
