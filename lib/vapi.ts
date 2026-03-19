// ============================================
// Zing - Vapi AI Voice Agent Integration
// ============================================
// Creates and manages Vapi voice assistants for each business.
// When a call goes to AI fallback, we transfer to the Vapi agent.
//
// Required env vars:
//   VAPI_API_KEY     - your Vapi private API key
//   VAPI_PHONE_ID    - (optional) Vapi phone number ID for outbound
//
// Optional:
//   ZING_AI_LLM_MODEL - OpenAI model id (default: gpt-4o)
//   VAPI_WEBHOOK_SECRET - query param on server URL for tool webhooks
//   NEXT_PUBLIC_APP_URL - base URL for assistant server webhook

import { getAppUrl } from "./telnyx"
import {
  buildIntakeSystemExtension,
  normalizeIntakeConfig,
  type AiIntakeConfig,
} from "./ai-intake-defaults"

const VAPI_BASE = "https://api.vapi.ai"

function getAssistantLlmModel(): string {
  const m = process.env.ZING_AI_LLM_MODEL?.trim()
  return m || "gpt-4o"
}

function buildVapiElevenLabsVoice(voiceId: string) {
  return {
    provider: "11labs",
    voiceId,
    stability: 0.45,
    similarityBoost: 0.82,
  }
}

function getVapiKey(): string {
  const key = process.env.VAPI_API_KEY
  if (!key) throw new Error("Missing VAPI_API_KEY — add it in Vercel → Settings → Environment Variables")
  return key
}

async function vapiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getVapiKey()}`,
      ...options.headers,
    },
  })
  const body = await res.json()
  if (!res.ok) {
    const errMsg = body?.message || body?.error || JSON.stringify(body)
    throw new Error(`Vapi ${res.status}: ${errMsg}`)
  }
  return body
}

/** Vapi model.functions entry — saves leads via Zing webhook. */
const SUBMIT_ZING_LEAD_FUNCTION = {
  name: "submit_zing_lead",
  description:
    "Save this caller as a lead and notify the business. Call ONCE after you have collected the required details for their situation. Required before ending the call if you took their information.",
  parameters: {
    type: "object",
    properties: {
      intent_slug: {
        type: "string",
        description:
          "Use the intent_slug values defined in your system instructions for this business (varies by trade). Always include callback_number and issue_summary.",
      },
      caller_name: { type: "string", description: "Caller's name if known" },
      callback_number: { type: "string", description: "Best phone number to reach them" },
      vehicle_make: { type: "string" },
      vehicle_model: { type: "string" },
      vehicle_year: { type: "string" },
      service_address: { type: "string", description: "Service location or full address" },
      issue_summary: { type: "string", description: "One short sentence describing what they need" },
    },
    required: ["intent_slug", "callback_number", "issue_summary"],
  },
}

function vapiWebhookServerUrl(): string | null {
  try {
    const base = getAppUrl().replace(/\/$/, "")
    if (!base) return null
    const secret = process.env.VAPI_WEBHOOK_SECRET?.trim()
    const path = "/api/webhooks/vapi"
    return secret ? `${base}${path}?s=${encodeURIComponent(secret)}` : `${base}${path}`
  } catch {
    return null
  }
}

function composeAssistantSystemPrompt(params: {
  businessName: string
  ownerPhone: string
  businessHours?: string
  customInstructions?: string
  intakeConfig?: AiIntakeConfig | null
  /** From users.industry when intake has no profileId override */
  userIndustry?: string | null
}): string {
  const cfg = normalizeIntakeConfig(params.intakeConfig ?? {}, {
    userIndustry: params.userIndustry,
  })
  const hours = (params.businessHours || "Monday through Friday, 9 AM to 5 PM. Closed weekends.").trim()
  let core = buildIntakeSystemExtension(
    params.businessName,
    params.ownerPhone,
    hours,
    cfg
  )
  const custom = (params.customInstructions || "").trim()
  if (custom) {
    core += `\n\n## Additional business-specific instructions from the owner\n${custom}`
  }
  return core
}

function buildModelBlock(args: {
  businessName: string
  ownerPhone: string
  businessHours?: string
  customInstructions?: string
  intakeConfig?: AiIntakeConfig | null
  userIndustry?: string | null
  temperature: number
}) {
  return {
    provider: "openai",
    model: getAssistantLlmModel(),
    messages: [
      {
        role: "system",
        content: composeAssistantSystemPrompt({
          businessName: args.businessName,
          ownerPhone: args.ownerPhone,
          businessHours: args.businessHours,
          customInstructions: args.customInstructions,
          intakeConfig: args.intakeConfig,
          userIndustry: args.userIndustry,
        }),
      },
    ],
    temperature: args.temperature,
    functions: [SUBMIT_ZING_LEAD_FUNCTION],
  }
}

export async function createVapiAssistant(params: {
  businessName: string
  greeting: string
  ownerPhone: string
  voiceId?: string
  businessHours?: string
  customInstructions?: string
  temperature?: number
  endCallMessage?: string
  maxDurationSeconds?: number
  silenceTimeoutSeconds?: number
  intakeConfig?: AiIntakeConfig | null
  userIndustry?: string | null
}): Promise<{ id: string; phoneNumber?: string }> {
  const {
    businessName,
    greeting,
    ownerPhone,
    voiceId,
    businessHours,
    customInstructions,
    temperature,
    endCallMessage,
    maxDurationSeconds,
    silenceTimeoutSeconds,
    intakeConfig,
    userIndustry,
  } = params

  const serverUrl = vapiWebhookServerUrl()
  const body: Record<string, unknown> = {
    name: `Zing - ${businessName}`,
    model: buildModelBlock({
      businessName,
      ownerPhone,
      businessHours,
      customInstructions,
      intakeConfig: intakeConfig ?? normalizeIntakeConfig({}, { userIndustry }),
      userIndustry,
      temperature: typeof temperature === "number" ? temperature : 0.7,
    }),
    voice: buildVapiElevenLabsVoice(voiceId || "21m00Tcm4TlvDq8ikWAM"),
    firstMessage:
      greeting ||
      `Thank you for calling ${businessName}. No one is available right now, but I'd be happy to help. How can I assist you?`,
    endCallMessage: endCallMessage || "Thank you for calling. Have a great day!",
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    silenceTimeoutSeconds: typeof silenceTimeoutSeconds === "number" ? silenceTimeoutSeconds : 30,
    maxDurationSeconds: typeof maxDurationSeconds === "number" ? maxDurationSeconds : 300,
    endCallFunctionEnabled: true,
  }
  if (serverUrl) {
    body.server = { url: serverUrl }
  }

  const assistant = await vapiFetch("/assistant", {
    method: "POST",
    body: JSON.stringify(body),
  })

  return { id: assistant.id }
}

export async function updateVapiAssistant(
  assistantId: string,
  params: {
    greeting?: string
    voiceId?: string
    endCallMessage?: string
    maxDurationSeconds?: number
    silenceTimeoutSeconds?: number
    /**
     * When provided, replaces model (system prompt + tools + temperature) in one shot.
     * Always pass full business context from the API route — do not send partial prompt updates.
     */
    promptBundle?: {
      businessName: string
      ownerPhone: string
      businessHours?: string
      customInstructions?: string
      intakeConfig: AiIntakeConfig | null
      temperature: number
      userIndustry?: string | null
    }
  }
): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (params.greeting) {
    updates.firstMessage = params.greeting
  }

  if (params.promptBundle) {
    const b = params.promptBundle
    updates.model = buildModelBlock({
      businessName: b.businessName,
      ownerPhone: b.ownerPhone,
      businessHours: b.businessHours,
      customInstructions: b.customInstructions,
      intakeConfig: b.intakeConfig ?? normalizeIntakeConfig({}, { userIndustry: b.userIndustry }),
      userIndustry: b.userIndustry,
      temperature: b.temperature,
    })
    const serverUrl = vapiWebhookServerUrl()
    if (serverUrl) {
      updates.server = { url: serverUrl }
    }
  }

  if (params.voiceId) {
    updates.voice = buildVapiElevenLabsVoice(params.voiceId)
  }

  if (params.endCallMessage) {
    updates.endCallMessage = params.endCallMessage
  }

  if (typeof params.maxDurationSeconds === "number") {
    updates.maxDurationSeconds = params.maxDurationSeconds
  }

  if (typeof params.silenceTimeoutSeconds === "number") {
    updates.silenceTimeoutSeconds = params.silenceTimeoutSeconds
  }

  if (Object.keys(updates).length > 0) {
    await vapiFetch(`/assistant/${assistantId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
  }
}

export async function createVapiCall(params: {
  assistantId: string
  customerNumber: string
}): Promise<{ callId: string; status: string }> {
  const call = await vapiFetch("/call/phone", {
    method: "POST",
    body: JSON.stringify({
      assistantId: params.assistantId,
      customer: {
        number: params.customerNumber,
      },
    }),
  })

  return { callId: call.id, status: call.status }
}

export async function getVapiAssistant(assistantId: string) {
  return vapiFetch(`/assistant/${assistantId}`)
}

export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" })
}
