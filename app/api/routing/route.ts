// ============================================
// GET/PUT /api/routing
// ============================================
// Get or update call routing configuration.
// Supports per-number routing via ?number=+15025571219 query param.
// Without the param, operates on the default/global config.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUser, getRoutingConfig, getRoutingConfigForNumber, getAllRoutingConfigs, updateRoutingConfig } from "@/lib/db"
import type { UpdateRoutingRequest } from "@/lib/types"
import {
  ensureTelnyxVoiceAiAssistant,
  syncTelnyxAssistantFromIntake,
  type EnsureTelnyxVoiceAiResult,
} from "@/lib/telnyx-ai-assistant-lifecycle"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const number = req.nextUrl.searchParams.get("number")
    const all = req.nextUrl.searchParams.get("all")

    // ?all=true → return every config (default + per-number)
    if (all === "true") {
      const configs = await getAllRoutingConfigs(userId)
      return NextResponse.json({ configs })
    }

    // ?number=+1xxx → return config for that specific number (with fallback to default)
    if (number) {
      const config = await getRoutingConfigForNumber(userId, number)
      return NextResponse.json({ config })
    }

    // No params → return default config
    const config = await getRoutingConfig(userId)
    return NextResponse.json({ config })
  } catch (error) {
    console.error("[Zing] Error fetching routing config:", error)
    return NextResponse.json({ error: "Failed to fetch routing config" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body: UpdateRoutingRequest & { business_number?: string } = await req.json()
    const businessNumber = body.business_number || null

    await updateRoutingConfig(
      userId,
      {
        selected_receptionist_id: body.selected_receptionist_id,
        fallback_type: body.fallback_type,
        ai_greeting: body.ai_greeting,
        ring_timeout_seconds: body.ring_timeout_seconds,
      },
      businessNumber
    )

    const updated = businessNumber
      ? await getRoutingConfigForNumber(userId, businessNumber)
      : await getRoutingConfig(userId)

    let voiceAi: EnsureTelnyxVoiceAiResult | undefined
    const shouldProvisionVoiceAi =
      updated?.fallback_type === "ai" &&
      (body.fallback_type === "ai" || body.ai_greeting !== undefined)
    if (shouldProvisionVoiceAi) {
      voiceAi = await ensureTelnyxVoiceAiAssistant(userId, {
        greeting: typeof body.ai_greeting === "string" ? body.ai_greeting : undefined,
      })
      if (typeof body.ai_greeting === "string") {
        const u = await getUser(userId)
        if (u?.telnyx_ai_assistant_id?.trim()) {
          try {
            await syncTelnyxAssistantFromIntake(userId)
          } catch (e) {
            console.error("[PUT /api/routing] Telnyx sync after greeting:", e)
          }
        }
      }
    }

    return NextResponse.json({ config: updated, ...(voiceAi ? { voiceAi } : {}) })
  } catch (error) {
    console.error("[Zing] Error updating routing config:", error)
    return NextResponse.json({ error: "Failed to update routing config" }, { status: 500 })
  }
}
