// ============================================
// Zing - Vapi AI Voice Agent Integration
// ============================================
// Creates and manages Vapi voice assistants for each business.
// When a call goes to AI fallback, we transfer to the Vapi agent
// which handles natural conversation, message-taking, etc.
//
// Required env vars:
//   VAPI_API_KEY     - your Vapi private API key
//   VAPI_PHONE_ID    - (optional) Vapi phone number ID for outbound
//
// Optional (platform / operator only — customers never set these):
//   ZING_AI_LLM_MODEL - OpenAI model id for the assistant (default: gpt-4o for quality)

const VAPI_BASE = "https://api.vapi.ai"

/** LLM for spoken receptionist; gpt-4o default for natural reasoning; override to gpt-4o-mini to save cost. */
function getAssistantLlmModel(): string {
  const m = process.env.ZING_AI_LLM_MODEL?.trim()
  return m || "gpt-4o"
}

/** ElevenLabs voice block tuned for natural phone speech (Vapi forwards these to 11labs). */
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

// Generic Vapi API helper
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

// Create a Vapi assistant configured for a specific business
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
  } = params

  const assistant = await vapiFetch("/assistant", {
    method: "POST",
    body: JSON.stringify({
      name: `Zing - ${businessName}`,
      model: {
        provider: "openai",
        model: getAssistantLlmModel(),
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              businessName,
              ownerPhone,
              businessHours,
              customInstructions,
            }),
          },
        ],
        temperature: typeof temperature === "number" ? temperature : 0.7,
      },
      voice: buildVapiElevenLabsVoice(voiceId || "21m00Tcm4TlvDq8ikWAM"),
      firstMessage: greeting || `Thank you for calling ${businessName}. No one is available right now, but I'd be happy to help. How can I assist you?`,
      endCallMessage: endCallMessage || "Thank you for calling. Have a great day!",
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      silenceTimeoutSeconds: typeof silenceTimeoutSeconds === "number" ? silenceTimeoutSeconds : 30,
      maxDurationSeconds: typeof maxDurationSeconds === "number" ? maxDurationSeconds : 300,
      endCallFunctionEnabled: true,
    }),
  })

  return { id: assistant.id }
}

// Update an existing Vapi assistant (e.g. when user changes greeting or business name)
export async function updateVapiAssistant(
  assistantId: string,
  params: {
    businessName?: string
    greeting?: string
    ownerPhone?: string
    voiceId?: string
    businessHours?: string
    customInstructions?: string
    temperature?: number
    endCallMessage?: string
    maxDurationSeconds?: number
    silenceTimeoutSeconds?: number
  }
): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (params.greeting) {
    updates.firstMessage = params.greeting
  }

  if (
    params.businessName ||
    params.ownerPhone ||
    params.businessHours ||
    params.customInstructions ||
    typeof params.temperature === "number"
  ) {
    updates.model = {
      provider: "openai",
      model: getAssistantLlmModel(),
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            businessName: params.businessName || "the business",
            ownerPhone: params.ownerPhone || "",
            businessHours: params.businessHours,
            customInstructions: params.customInstructions,
          }),
        },
      ],
      temperature: typeof params.temperature === "number" ? params.temperature : 0.7,
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

// Create a Vapi phone call (transfer an active call to Vapi)
// Returns a phone number to transfer/dial into
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

// Get a Vapi assistant by ID
export async function getVapiAssistant(assistantId: string) {
  return vapiFetch(`/assistant/${assistantId}`)
}

// Delete a Vapi assistant
export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" })
}

// Build the system prompt for the AI receptionist
function buildSystemPrompt(params: {
  businessName: string
  ownerPhone: string
  businessHours?: string
  customInstructions?: string
}): string {
  const { businessName, ownerPhone, businessHours, customInstructions } = params
  const hours = (businessHours || "Monday through Friday, 9 AM to 5 PM. Closed weekends.").trim()
  const custom = (customInstructions || "").trim()

  return `You are a friendly and professional AI phone receptionist for ${businessName}.
You are answering a call that came in when no one at the business was available to pick up.

Your personality:
- Warm, helpful, and professional
- Speak naturally like a real receptionist, not robotic
- Keep responses concise (1-2 sentences) since they're spoken aloud
- Don't say "as an AI" or mention being artificial — just be a helpful receptionist
- Confirm important details (names, times, phone numbers) by repeating them clearly

Your capabilities:
1. TAKE MESSAGES: Ask for their name, phone number, and message. For phone numbers, repeat digits back in small groups so the caller can confirm.
2. SHARE BUSINESS HOURS: ${hours}
3. BOOK APPOINTMENTS: Collect their preferred date, time, name, and callback number.
4. ANSWER COMMON QUESTIONS: Be helpful but honest — if you don't know specific details about ${businessName}, say "I'll have someone from the team get back to you with that information."
5. TRANSFER: If they urgently need to reach someone, let them know you'll try to connect them.

${ownerPhone ? `The business owner's number is ${ownerPhone} for urgent transfers.` : ""}
${custom ? `\nAdditional business rules:\n${custom}\n` : ""}

Always end by asking "Is there anything else I can help you with?" before saying goodbye.
If the caller is done, say a brief, warm farewell.`
}
