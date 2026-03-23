// ============================================
// GET/POST/PATCH /api/ai-assistant
// ============================================
// Telnyx Voice AI: Zing creates/updates assistants via POST /v2/ai/assistants (no Mission Control for end users).
// Optional manual id still supported for support/debug. Fallback TeXML uses <AIAssistant id="…">.

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
import {
  normalizeIntakeConfig,
  buildFullTelnyxInstructions,
  resolveTelnyxAssistantGreeting,
  type AiIntakeConfig,
} from "@/lib/ai-intake-defaults"
import { isAiIntakeProfileId } from "@/lib/business-industries"
import {
  telnyxCreateAssistant,
  telnyxUpdateAssistant,
  type UpdateTelnyxAssistantParams,
  resolveAssistantModel,
  resolveAssistantVoice,
} from "@/lib/telnyx-voice-ai-api"

/** Default hours line embedded in assistant instructions when we have no separate business-hours field. */
const DEFAULT_BUSINESS_HOURS = "Monday through Friday, 9 AM to 5 PM. Closed weekends."

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
  const clearable = ["telnyxModel", "telnyxVoice", "extraAiInstructions"] as const
  for (const key of clearable) {
    if (incoming && key in incoming && incoming[key] === "") {
      delete base[key]
    }
  }
  return base
}

/** Push latest intake playbook + opening line to Telnyx for this user’s linked assistant. */
async function syncTelnyxAssistantFromIntake(userId: string): Promise<void> {
  const u = await getUser(userId)
  const aid = u?.telnyx_ai_assistant_id?.trim()
  if (!u || !aid) return
  const raw = await getAiIntakeConfigRaw(userId)
  const cfg = normalizeIntakeConfig(raw, { userIndustry: u.industry })
  const instructions = buildFullTelnyxInstructions(u.business_name, u.phone, DEFAULT_BUSINESS_HOURS, cfg)
  const greeting = resolveTelnyxAssistantGreeting(cfg)
  const updates: UpdateTelnyxAssistantParams = { instructions, greeting }
  if (cfg.telnyxModel?.trim()) updates.model = cfg.telnyxModel.trim()
  if (cfg.telnyxVoice?.trim()) updates.voice_settings = { voice: cfg.telnyxVoice.trim() }
  await telnyxUpdateAssistant(aid, updates)
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

    const intakeCfg: AiIntakeConfig = normalizeIntakeConfig(merged, { userIndustry: user.industry })
    const telnyxGreeting = resolveTelnyxAssistantGreeting(intakeCfg)
    const instructions = buildFullTelnyxInstructions(
      user.business_name,
      user.phone,
      DEFAULT_BUSINESS_HOURS,
      intakeCfg
    )

    let assistantId: string
    let provisioned = false

    if (fromBody) {
      assistantId = fromBody
    } else {
      try {
        const created = await telnyxCreateAssistant({
          name: `Zing — ${user.business_name}`.slice(0, 120),
          instructions,
          greeting: telnyxGreeting,
          model: resolveAssistantModel(intakeCfg.telnyxModel),
          voice: resolveAssistantVoice(intakeCfg.telnyxVoice),
        })
        assistantId = created.id
        provisioned = true
      } catch (e) {
        if (fromEnv) {
          assistantId = fromEnv
          console.error("[POST /api/ai-assistant] Telnyx create failed, using TELNYX_AI_ASSISTANT_ID:", e)
        } else {
          const msg = e instanceof Error ? e.message : "Failed to create Telnyx assistant"
          return NextResponse.json(
            {
              error: `${msg}. Set TELNYX_AI_ASSISTANT_ID as a temporary platform default, or ask support.`,
            },
            { status: 502 }
          )
        }
      }
    }

    await updateUser(userId, { telnyx_ai_assistant_id: assistantId })

    return NextResponse.json({
      success: true,
      assistantId,
      provisioned,
      message: provisioned
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

    const assistantIdSent = typeof telnyxAiAssistantId === "string"
    if (assistantIdSent) {
      const trimmed = telnyxAiAssistantId.trim()
      await updateUser(userId, { telnyx_ai_assistant_id: trimmed || null })
    }

    const hasIntake = intakeBody !== undefined && typeof intakeBody === "object"
    const hasGreeting = typeof greeting === "string" && greeting.trim().length > 0
    if (!hasIntake && !hasGreeting && !assistantIdSent) {
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

    const fresh = await getUser(userId)
    const linked = fresh?.telnyx_ai_assistant_id?.trim()
    if (linked && (hasIntake || hasGreeting || (assistantIdSent && Boolean(telnyxAiAssistantId.trim())))) {
      try {
        await syncTelnyxAssistantFromIntake(userId)
      } catch (e) {
        console.error("[PATCH /api/ai-assistant] Telnyx assistant sync failed:", e)
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
