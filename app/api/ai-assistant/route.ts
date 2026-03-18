// ============================================
// GET/POST/PATCH /api/ai-assistant
// ============================================
// Manages the user's Vapi AI voice assistant.
// GET: returns current assistant status
// POST: creates a new Vapi assistant for this user
// PATCH: updates the assistant (greeting, business name)

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUser, getRoutingConfig, updateUser } from "@/lib/db"
import { createVapiAssistant, updateVapiAssistant } from "@/lib/vapi"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    hasAssistant: !!user.vapi_assistant_id,
    assistantId: user.vapi_assistant_id,
  })
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const user = await getUser(userId)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (user.vapi_assistant_id) {
      return NextResponse.json({
        success: true,
        assistantId: user.vapi_assistant_id,
        message: "AI assistant already exists",
      })
    }

    const config = await getRoutingConfig(userId)
    const greeting = config?.ai_greeting || `Thank you for calling ${user.business_name}. No one is available right now, but I'd be happy to help. How can I assist you?`

    const assistant = await createVapiAssistant({
      businessName: user.business_name || "the business",
      greeting,
      ownerPhone: user.phone,
    })

    await updateUser(userId, { vapi_assistant_id: assistant.id })

    console.log(`[Zing] Vapi assistant created for user ${userId}: ${assistant.id}`)

    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      message: "AI assistant activated!",
    })
  } catch (error) {
    console.error("[Zing] Error creating Vapi assistant:", error)
    const msg = error instanceof Error ? error.message : "Failed to create AI assistant"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const user = await getUser(userId)
    if (!user?.vapi_assistant_id) {
      return NextResponse.json({ error: "No AI assistant configured" }, { status: 400 })
    }

    const body = await req.json()
    const { greeting, businessName } = body as { greeting?: string; businessName?: string }

    await updateVapiAssistant(user.vapi_assistant_id, {
      greeting,
      businessName: businessName || user.business_name,
      ownerPhone: user.phone,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Zing] Error updating Vapi assistant:", error)
    return NextResponse.json({ error: "Failed to update AI assistant" }, { status: 500 })
  }
}
