// ============================================
// GET/POST/PATCH /api/ai-assistant
// ============================================
// Telnyx Voice AI: provision/sync via lib/telnyx-ai-assistant-lifecycle.
// Choosing AI fallback on /api/routing also auto-provisions — POST remains for explicit activate / advanced.

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
import { normalizeIntakeConfig, type AiIntakeConfig } from "@/lib/ai-intake-defaults"
import {
  mergeIntakeConfigForAi,
  syncTelnyxAssistantFromIntake,
  ensureTelnyxVoiceAiAssistant,
} from "@/lib/telnyx-ai-assistant-lifecycle"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    const intakeRaw = await getAiIntakeConfigRaw(userId)
    const intakeConfig: AiIntakeConfig = normalizeIntakeConfig(intakeRaw, { userIndustry: user.industry })

    return NextResponse.json({
      hasAssistant: Boolean(user.telnyx_ai_assistant_id?.trim()),
      assistantId: user.telnyx_ai_assistant_id,
      assistantConfig: null,
      intakeConfig,
      intakeStored: intakeRaw,
      provider: "telnyx",
    })
  } catch (e) {
    console.error("[GET /api/ai-assistant] failed:", e)
    const intakeConfig: AiIntakeConfig = normalizeIntakeConfig(null, { userIndustry: user.industry })
    return NextResponse.json({
      hasAssistant: Boolean(user.telnyx_ai_assistant_id?.trim()),
      assistantId: user.telnyx_ai_assistant_id,
      assistantConfig: null,
      intakeConfig,
      intakeStored: null,
      provider: "telnyx",
      degraded: true,
      warning:
        "Could not load intake. Check Neon has scripts/010-ai-leads-intake.sql and 012-telnyx-ai-assistant.sql applied.",
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
      intake: intakeBody,
      telnyxAiAssistantId: bodyAssistantId,
    } = body as {
      greeting?: string
      intake?: Record<string, unknown>
      telnyxAiAssistantId?: string
    }

    const user = await getUser(userId)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const fromBody = typeof bodyAssistantId === "string" ? bodyAssistantId.trim() : ""

    if (user.telnyx_ai_assistant_id?.trim()) {
      return NextResponse.json({
        success: true,
        assistantId: user.telnyx_ai_assistant_id,
        message: "Telnyx assistant already linked",
        provider: "telnyx",
      })
    }

    const result = await ensureTelnyxVoiceAiAssistant(userId, {
      intake: intakeBody,
      greeting: requestedGreeting,
      telnyxAiAssistantId: fromBody || undefined,
    })

    if (!result.linked || !result.assistantId) {
      return NextResponse.json(
        {
          error: `${result.error || "Failed to activate"}. Set TELNYX_AI_ASSISTANT_ID as a temporary platform default, or ask support.`,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      assistantId: result.assistantId,
      provisioned: result.provisioned,
      message: result.provisioned
        ? "Voice assistant created on your line — no-answer calls will connect to it automatically."
        : "Telnyx Voice AI linked — no-answer fallback will use this assistant on the live call.",
      provider: "telnyx",
    })
  } catch (error) {
    console.error("[POST /api/ai-assistant] failed:", error)
    const msg = error instanceof Error ? error.message : "Failed to activate"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const user = await getUser(userId)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body — try again or refresh the page." }, { status: 400 })
    }
    const {
      greeting,
      intake: intakeBody,
      telnyxAiAssistantId,
    } = body as {
      greeting?: string
      intake?: Record<string, unknown>
      telnyxAiAssistantId?: string
    }

    const assistantIdSent = typeof telnyxAiAssistantId === "string"
    if (assistantIdSent) {
      const trimmed = telnyxAiAssistantId.trim()
      await updateUser(userId, { telnyx_ai_assistant_id: trimmed || null })
    }

    const hasIntake =
      intakeBody !== undefined &&
      intakeBody !== null &&
      typeof intakeBody === "object" &&
      !Array.isArray(intakeBody)
    const hasGreeting = typeof greeting === "string" && greeting.trim().length > 0
    if (!hasIntake && !hasGreeting && !assistantIdSent) {
      return NextResponse.json({ error: "Nothing to update — send intake, greeting, or telnyxAiAssistantId." }, { status: 400 })
    }

    if (hasIntake || hasGreeting) {
      const prevIntake = await getAiIntakeConfigRaw(userId)
      const merged = mergeIntakeConfigForAi(prevIntake, intakeBody, greeting)
      await upsertAiIntakeConfig(userId, merged)
      if (hasGreeting) {
        await updateRoutingConfig(userId, { ai_greeting: greeting!.trim() }, null)
      }
    }

    const rc = await getRoutingConfig(userId)
    if (rc?.fallback_type === "ai") {
      await ensureTelnyxVoiceAiAssistant(userId)
    }

    const fresh = await getUser(userId)
    const linked = fresh?.telnyx_ai_assistant_id?.trim()
    let telnyxSyncError: string | null = null
    if (linked && (hasIntake || hasGreeting || (assistantIdSent && Boolean(telnyxAiAssistantId.trim())))) {
      try {
        await syncTelnyxAssistantFromIntake(userId)
      } catch (e) {
        console.error("[PATCH /api/ai-assistant] Telnyx assistant sync failed:", e)
        telnyxSyncError =
          e instanceof Error && e.message.trim() ? e.message.trim() : "Telnyx rejected the assistant update."
      }
    }

    return NextResponse.json({
      success: true,
      message: telnyxSyncError
        ? "Saved in Zing — Telnyx did not confirm the assistant update (see telnyxSyncError)."
        : "Saved.",
      provider: "telnyx",
      telnyxSyncError,
    })
  } catch (error) {
    console.error("[PATCH /api/ai-assistant] failed:", error)
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Could not save call flow (server error). Check Vercel logs or try again in a minute."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
