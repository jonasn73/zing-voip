// ============================================
// Telnyx / TeXML — two-step Voice AI handoff
// ============================================
// Some interpreters ignore or skip <Say> when it shares one <Response> with <Connect><AIAssistant>.
// Pattern: Say + Redirect → second URL returns only <Connect><AIAssistant> (see /api/voice/telnyx/ai-bridge/u/[userId]).

import { VoiceResponse, getAppUrl } from "@/lib/telnyx"

/**
 * TeXML that speaks a short line, then fetches the pure AI `<Connect>` document from our server.
 * Uses the Twilio `VoiceResponse` builder so `<Say>` matches what Telnyx expects for TwiML-compatible TeXML.
 * @param callSid — optional; forwarded on the redirect URL so the bridge can tie voicemail to the same call.
 */
export function buildSayThenRedirectToAiBridgeTeXML(userId: string, callSid?: string): string {
  const appUrl = getAppUrl()
  const cs = callSid?.trim()
  const qs = cs ? `?callSid=${encodeURIComponent(cs)}` : ""
  const vr = new VoiceResponse()
  vr.say(
    "Thanks for calling. Please hold a moment while we connect you to our assistant."
  )
  vr.redirect(
    { method: "POST" },
    `${appUrl}/api/voice/telnyx/ai-bridge/u/${encodeURIComponent(userId)}${qs}`
  )
  return vr.toString()
}
