// ============================================
// Zing - Legacy Compatibility Voice Helpers
// ============================================
// Install: pnpm add twilio
// Env vars needed:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_TWIML_APP_SID (optional, for outbound)
//   NEXT_PUBLIC_APP_URL (your deployed URL)

import twilio from "twilio"

// Legacy REST client used by compatibility endpoints.
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN")
  }
  return twilio(accountSid, authToken)
}

// Validate that an incoming legacy webhook is signed correctly.
export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false
  return twilio.validateRequest(authToken, signature, url, params)
}

// TwiML builder helpers
export const VoiceResponse = twilio.twiml.VoiceResponse

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"
}
