// ============================================
// GET/PUT /api/routing
// ============================================
// Get or update call routing configuration.
// The dashboard UI calls these to read/update who receives calls
// and what happens if they don't answer.

import { NextRequest, NextResponse } from "next/server"
import { getRoutingConfig, updateRoutingConfig, getReceptionists } from "@/lib/db"
import type { UpdateRoutingRequest } from "@/lib/types"

// TODO: Replace with actual auth -- get userId from session/JWT
const DEMO_USER_ID = "demo-user-id"

export async function GET() {
  try {
    const [config, receptionists] = await Promise.all([
      getRoutingConfig(DEMO_USER_ID),
      getReceptionists(DEMO_USER_ID),
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
  try {
    const body: UpdateRoutingRequest = await req.json()

    await updateRoutingConfig(DEMO_USER_ID, {
      selected_receptionist_id: body.selected_receptionist_id,
      fallback_type: body.fallback_type,
      ai_greeting: body.ai_greeting,
      ring_timeout_seconds: body.ring_timeout_seconds,
    })

    const updated = await getRoutingConfig(DEMO_USER_ID)
    return NextResponse.json({ config: updated })
  } catch (error) {
    console.error("[Zing] Error updating routing config:", error)
    return NextResponse.json(
      { error: "Failed to update routing config" },
      { status: 500 }
    )
  }
}
