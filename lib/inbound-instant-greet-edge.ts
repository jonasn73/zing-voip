// Edge-safe instant pass-1 TeXML (no DB, no Twilio SDK — runs in middleware before Node cold start).

/** Generic copy when pass 1 cannot read routing cache (speed > personalization). */
export const EDGE_GENERIC_GREETING_TEXT =
  "Thank you for calling. Please wait while we connect your call to a team member."

const DEFAULT_SAY_VOICE = "Polly.Joanna-Neural"
const DEFAULT_SAY_LANGUAGE = "en-US"

export function isVoiceIncomingWebhookPath(pathname: string): boolean {
  return pathname === "/api/voice/telnyx/incoming" || pathname === "/api/voice/incoming"
}

export function edgeInboundGreetingPassDone(url: URL): boolean {
  const v = url.searchParams.get("zingGreet")?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function edgeInboundGreetingFirstEnabled(): boolean {
  const raw = (process.env.ZING_INBOUND_GREETING_FIRST || "1").trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "no" && raw !== "off"
}

export function edgeInboundInstantGreetingAudioUrl(): string | null {
  const raw = (process.env.ZING_INBOUND_INSTANT_GREETING_AUDIO_URL || "").trim()
  return raw || null
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Pass-2 URL on the same webhook with `zingGreet=1` (Telnyx re-POSTs call body on Redirect). */
export function buildEdgeInboundGreetingContinueUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  url.searchParams.set("zingGreet", "1")
  return url.toString()
}

/** Prebuilt TeXML returned from Edge middleware — answers the call with audio ASAP. */
export function buildEdgeInstantGreetingTexml(continueUrl: string): string {
  const safeContinue = escapeXmlAttr(continueUrl)
  const audioUrl = edgeInboundInstantGreetingAudioUrl()
  if (audioUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${escapeXmlAttr(audioUrl)}</Play>
  <Redirect method="POST">${safeContinue}</Redirect>
</Response>`
  }
  const voice = (process.env.ZING_TEXML_SAY_VOICE || DEFAULT_SAY_VOICE).trim() || DEFAULT_SAY_VOICE
  const language = (process.env.ZING_TEXML_SAY_LANGUAGE || DEFAULT_SAY_LANGUAGE).trim() || DEFAULT_SAY_LANGUAGE
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXmlAttr(voice)}" language="${escapeXmlAttr(language)}">${escapeXmlText(EDGE_GENERIC_GREETING_TEXT)}</Say>
  <Redirect method="POST">${safeContinue}</Redirect>
</Response>`
}

export function shouldEdgeInstantGreetingIntercept(pathname: string, url: URL, method: string): boolean {
  if (!edgeInboundGreetingFirstEnabled()) return false
  if (!isVoiceIncomingWebhookPath(pathname)) return false
  if (method !== "POST" && method !== "GET") return false
  if (edgeInboundGreetingPassDone(url)) return false
  return true
}
