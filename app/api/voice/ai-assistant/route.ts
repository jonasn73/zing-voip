// ============================================
// POST /api/voice/ai-assistant
// ============================================
// AI-powered call handler using Twilio <Gather> + AI SDK.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/twilio"
import { getRoutingConfig, getUser } from "@/lib/db"
import { generateText } from "ai"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const speechResult = formData.get("SpeechResult") as string | null
  const userId = req.nextUrl.searchParams.get("userId") || ""
  const callSid = req.nextUrl.searchParams.get("callSid") || ""

  const twiml = new VoiceResponse()
  const appUrl = getAppUrl()

  try {
    const config = await getRoutingConfig(userId)
    const user = await getUser(userId)
    const greeting = config?.ai_greeting || "Thank you for calling. How can I help you?"
    const businessName = user?.business_name || "our business"

    if (!speechResult) {
      const gather = twiml.gather({
        input: ["speech"],
        speechTimeout: "auto",
        speechModel: "experimental_conversations",
        action: `${appUrl}/api/voice/ai-assistant?userId=${userId}&callSid=${callSid}`,
        method: "POST",
      })
      gather.say(greeting)

      twiml.say("I didn't hear anything. If you need help, please call back. Goodbye.")
      twiml.hangup()
    } else {
      const systemPrompt = `You are a friendly and professional phone receptionist for ${businessName}. 
You are speaking to a caller who reached the business after hours or when no one was available.

Your capabilities:
- Take messages: Ask for their name, phone number, and message. Confirm you'll pass it along.
- Share business hours: Mon-Fri 9am-5pm (customize in production from DB).
- Book appointments: Collect their preferred date/time, name, and phone number.
- Answer basic FAQs: Be helpful but don't make up specific information about the business.

Keep responses SHORT (1-2 sentences) since they'll be spoken aloud. Be warm but efficient.
If the caller wants to leave a message, collect the info and confirm.
If you've helped them, end with "Is there anything else I can help with?"
If they say no or goodbye, respond with a brief farewell.`

      const { text: aiResponse } = await generateText({
        model: "openai/gpt-4o-mini" as never,
        system: systemPrompt,
        prompt: speechResult,
      })

      const gather = twiml.gather({
        input: ["speech"],
        speechTimeout: "auto",
        speechModel: "experimental_conversations",
        action: `${appUrl}/api/voice/ai-assistant?userId=${userId}&callSid=${callSid}`,
        method: "POST",
      })
      gather.say(aiResponse)

      twiml.say("Thank you for calling. Goodbye.")
      twiml.hangup()
    }
  } catch (error) {
    console.error("[Zing] Error in AI assistant:", error)
    twiml.say("I'm sorry, I'm having trouble right now. Please leave a message after the beep.")
    twiml.record({
      maxLength: 120,
      transcribe: true,
      recordingStatusCallback: `${appUrl}/api/voice/recording-status`,
    })
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}
