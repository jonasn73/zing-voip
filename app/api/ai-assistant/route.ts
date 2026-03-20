// ============================================
// GET/POST/PATCH /api/ai-assistant
// ============================================
// Manages the user's Vapi AI voice assistant.
// GET: status + Vapi fields + saved intake config
// POST: create assistant (merges intake + passes prompt)
// PATCH: update assistant; optional `intake` object updates user_ai_intake and rebuilds prompt

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import {
  getUser,
  getRoutingConfig,
  updateUser,
  getAiIntakeConfigRaw,
  upsertAiIntakeConfig,
  updateRoutingConfig,
} from "@/lib/db"
import { createVapiAssistant, getVapiAssistant, updateVapiAssistant } from "@/lib/vapi"
import { normalizeIntakeConfig, type AiIntakeConfig } from "@/lib/ai-intake-defaults"
import { isAiIntakeProfileId } from "@/lib/business-industries"

/** Merge JSON intake config with previous row and optional greeting copy. */
function mergeIntakeConfig(
  prev: Record<string, unknown> | null,
  incoming: Record<string, unknown> | undefined,
  greeting: string | undefined
): Record<string, unknown> {
  const base = { ...(prev || {}), ...(incoming || {}) }
  const g = greeting?.trim()
  if (g && !(typeof base.busyGreeting === "string" && base.busyGreeting.trim())) {
    base.busyGreeting = g
  }
  if (incoming?.followIndustryForAi === true) {
    delete base.profileId
  }
  delete base.followIndustryForAi
  if (typeof base.profileId === "string" && !isAiIntakeProfileId(base.profileId)) {
    delete base.profileId
  }
  return base
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    const intakeRaw = await getAiIntakeConfigRaw(userId)
    const intakeConfig: AiIntakeConfig = normalizeIntakeConfig(intakeRaw, { userIndustry: user.industry })

    let assistantConfig: Record<string, unknown> | null = null
    if (user.vapi_assistant_id) {
      try {
        const assistant = await getVapiAssistant(user.vapi_assistant_id)
        assistantConfig = {
          firstMessage: assistant?.firstMessage || "",
          voiceId: assistant?.voice?.voiceId || "",
          temperature: assistant?.model?.temperature ?? 0.7,
          endCallMessage: assistant?.endCallMessage || "",
          maxDurationSeconds: assistant?.maxDurationSeconds ?? 300,
          silenceTimeoutSeconds: assistant?.silenceTimeoutSeconds ?? 30,
          systemPrompt:
            Array.isArray(assistant?.model?.messages)
              ? String(
                  assistant.model.messages.find(
                    (m: Record<string, unknown>) => m?.role === "system"
                  )?.content || ""
                )
              : "",
        }
      } catch {
        assistantConfig = null
      }
    }

    return NextResponse.json({
      hasAssistant: !!user.vapi_assistant_id,
      assistantId: user.vapi_assistant_id,
      assistantConfig,
      intakeConfig,
      intakeStored: intakeRaw,
    })
  } catch (e) {
    console.error("[GET /api/ai-assistant] failed:", e)
    const intakeConfig: AiIntakeConfig = normalizeIntakeConfig(null, { userIndustry: user.industry })
    return NextResponse.json({
      hasAssistant: !!user.vapi_assistant_id,
      assistantId: user.vapi_assistant_id,
      assistantConfig: null,
      intakeConfig,
      intakeStored: null,
      degraded: true,
      warning:
        "AI assistant data could not be loaded fully. Check server logs and that Neon has scripts/010-ai-leads-intake.sql applied.",
    })
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const {
      greeting: requestedGreeting,
      businessName: requestedBusinessName,
      voiceId,
      temperature,
      businessHours,
      customInstructions,
      endCallMessage,
      maxDurationSeconds,
      silenceTimeoutSeconds,
      intake: intakeBody,
    } = body as {
      greeting?: string
      businessName?: string
      voiceId?: string
      temperature?: number
      businessHours?: string
      customInstructions?: string
      endCallMessage?: string
      maxDurationSeconds?: number
      silenceTimeoutSeconds?: number
      intake?: Record<string, unknown>
    }

    const user = await getUser(userId)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (user.vapi_assistant_id) {
      return NextResponse.json({
        success: true,
        assistantId: user.vapi_assistant_id,
        message: "AI assistant already exists",
      })
    }

    const prevIntake = await getAiIntakeConfigRaw(userId)
    const merged = mergeIntakeConfig(prevIntake, intakeBody, requestedGreeting)
    await upsertAiIntakeConfig(userId, merged)
    const intakeConfig = normalizeIntakeConfig(await getAiIntakeConfigRaw(userId), {
      userIndustry: user.industry,
    })

    const config = await getRoutingConfig(userId)
    const greeting =
      requestedGreeting ||
      config?.ai_greeting ||
      `Thank you for calling ${user.business_name}. No one is available right now, but I'd be happy to help. How can I assist you?`

    const businessName =
      requestedBusinessName?.trim() || user.business_name?.trim() || user.name?.trim() || "My Business"

    const assistant = await createVapiAssistant({
      businessName,
      greeting,
      ownerPhone: user.phone,
      voiceId,
      temperature,
      businessHours,
      customInstructions,
      endCallMessage,
      maxDurationSeconds,
      silenceTimeoutSeconds,
      intakeConfig,
      userIndustry: user.industry,
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
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json()
    const {
      greeting,
      businessName,
      voiceId,
      temperature,
      businessHours,
      customInstructions,
      endCallMessage,
      maxDurationSeconds,
      silenceTimeoutSeconds,
      intake: intakeBody,
    } = body as {
      greeting?: string
      businessName?: string
      voiceId?: string
      temperature?: number
      businessHours?: string
      customInstructions?: string
      endCallMessage?: string
      maxDurationSeconds?: number
      silenceTimeoutSeconds?: number
      intake?: Record<string, unknown>
    }

    // No Vapi assistant yet: still persist intake + optional greeting so the AI Call Flow page works pre-activation.
    if (!user.vapi_assistant_id) {
      const hasIntake = intakeBody !== undefined && typeof intakeBody === "object"
      const hasGreeting = typeof greeting === "string" && greeting.trim().length > 0
      if (!hasIntake && !hasGreeting) {
        return NextResponse.json(
          {
            error:
              "No voice assistant yet. Use Save on the AI call flow page (with intake fields) or activate the assistant in Settings.",
          },
          { status: 400 }
        )
      }
      const prevIntake = await getAiIntakeConfigRaw(userId)
      const merged = mergeIntakeConfig(prevIntake, intakeBody, greeting)
      await upsertAiIntakeConfig(userId, merged)
      if (hasGreeting) {
        await updateRoutingConfig(userId, { ai_greeting: greeting!.trim() }, null)
      }
      return NextResponse.json({
        success: true,
        message: hasGreeting
          ? "Saved. Activate the voice assistant in AI flow or Settings to use this on live calls."
          : "Intake saved. Activate the voice assistant when you are ready.",
      })
    }

    const prevIntake = await getAiIntakeConfigRaw(userId)
    const merged = mergeIntakeConfig(prevIntake, intakeBody, greeting)
    await upsertAiIntakeConfig(userId, merged)
    const intakeConfig = normalizeIntakeConfig(await getAiIntakeConfigRaw(userId), {
      userIndustry: user.industry,
    })

    let assistantTemperature = 0.7
    try {
      const current = await getVapiAssistant(user.vapi_assistant_id)
      if (typeof current?.model?.temperature === "number") {
        assistantTemperature = current.model.temperature
      }
    } catch {
      /* keep default */
    }

    const resolvedTemp = typeof temperature === "number" ? temperature : assistantTemperature
    const resolvedBusinessName =
      businessName?.trim() || user.business_name?.trim() || user.name?.trim() || "My Business"

    await updateVapiAssistant(user.vapi_assistant_id, {
      greeting,
      voiceId,
      endCallMessage,
      maxDurationSeconds,
      silenceTimeoutSeconds,
      promptBundle: {
        businessName: resolvedBusinessName,
        ownerPhone: user.phone,
        businessHours,
        customInstructions,
        intakeConfig,
        temperature: resolvedTemp,
        userIndustry: user.industry,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Zing] Error updating Vapi assistant:", error)
    return NextResponse.json({ error: "Failed to update AI assistant" }, { status: 500 })
  }
}
