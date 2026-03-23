// ============================================
// Telnyx TeXML — built-in Voice AI on the live call
// ============================================
// Docs: https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/aiassistant
// Caller stays on the same PSTN leg; no outbound callback provider.

/** Escape a string for use inside XML double-quoted attributes. */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * TeXML that hands the current call to a Telnyx AI Assistant (configured in Mission Control).
 * `assistantId` is the UUID from Telnyx → Voice AI → Assistants.
 */
export function buildTelnyxAiAssistantTexml(assistantId: string): string {
  const id = escapeXmlAttr(assistantId.trim())
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><AIAssistant id="${id}"/></Connect></Response>`
}
