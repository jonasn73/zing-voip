// ============================================
// GET/POST/PATCH /api/ai-assistant
// ============================================
// Telnyx Voice AI: user pastes Assistant id from Mission Control; fallback TeXML uses <AIAssistant>.
// Intake + greetings still saved here for your playbook copy in the app (configure full behavior in Telnyx).

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
import { isAiIntakeProfileId } from "@/lib/business-industries"

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
    const fromEnv = process.env.TELNYX_AI_ASSISTANT_ID?.trim() || ""
    const assistantId = fromBody || fromEnv

    if (!assistantId) {
      return NextResponse.json(
        {
          error:
            "Add your Telnyx Voice AI Assistant id (Mission Control → Voice AI → Assistants), or set TELNYX_AI_ASSISTANT_ID for a platform default.",
        },
        { status: 400 }
      )
    }

    if (user.telnyx_ai_assistant_id?.trim()) {
      return NextResponse.json({
        success: true,
        assistantId: user.telnyx_ai_assistant_id,
        message: "Telnyx assistant already linked",
        provider: "telnyx",
      })
    }

    const prevIntake = await getAiIntakeConfigRaw(userId)
    const merged = mergeIntakeConfig(prevIntake, intakeBody, requestedGreeting)
    await upsertAiIntakeConfig(userId, merged)

    const config = await getRoutingConfig(userId)
    const greeting =
      requestedGreeting ||
      config?.ai_greeting ||
      `Thank you for calling ${user.business_name}. No one is available right now, but I'd be happy to help. How can I assist you?`

    if (requestedGreeting?.trim()) {
      await updateRoutingConfig(userId, { ai_greeting: requestedGreeting.trim() }, null)
    } else if (greeting && !config?.ai_greeting) {
      await updateRoutingConfig(userId, { ai_greeting: greeting }, null)
    }

    await updateUser(userId, { telnyx_ai_assistant_id: assistantId })

    return NextResponse.json({
      success: true,
      assistantId,
      message: "Telnyx Voice AI linked — no-answer fallback will use this assistant on the live call.",
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

    const body = await req.json()
    const {
      greeting,
      intake: intakeBody,
      telnyxAiAssistantId,
    } = body as {
      greeting?: string
      intake?: Record<string, unknown>
      telnyxAiAssistantId?: string
    }

    if (typeof telnyxAiAssistantId === "string") {
      const trimmed = telnyxAiAssistantId.trim()
      await updateUser(userId, { telnyx_ai_assistant_id: trimmed || null })
    }

    const hasIntake = intakeBody !== undefined && typeof intakeBody === "object"
    const hasGreeting = typeof greeting === "string" && greeting.trim().length > 0
    if (!hasIntake && !hasGreeting && typeof telnyxAiAssistantId !== "string") {
      return NextResponse.json({ error: "Nothing to update — send intake, greeting, or telnyxAiAssistantId." }, { status: 400 })
    }

    if (hasIntake || hasGreeting) {
      const prevIntake = await getAiIntakeConfigRaw(userId)
      const merged = mergeIntakeConfig(prevIntake, intakeBody, greeting)
      await upsertAiIntakeConfig(userId, merged)
      if (hasGreeting) {
        await updateRoutingConfig(userId, { ai_greeting: greeting!.trim() }, null)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Saved.",
      provider: "telnyx",
    })
  } catch (error) {
    console.error("[PATCH /api/ai-assistant] failed:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
