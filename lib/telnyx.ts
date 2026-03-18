// ============================================
// Telnyx Client & TeXML Helpers
// ============================================
// Use Telnyx for voice (TeXML) and numbers instead of or alongside Twilio.
// Install: npm install telnyx
// Env vars:
//   TELNYX_API_KEY          - REST API (required for numbers, etc.)
//   TELNYX_PUBLIC_KEY       - Optional: for webhook signature verification
//   NEXT_PUBLIC_APP_URL     - Your deployed URL (shared with Twilio config)

import Telnyx from "telnyx"
// Reuse TwiML for TeXML: Telnyx TeXML is TwiML-compatible (same <Response>, <Dial>, <Say>, etc.)
import twilio from "twilio"

// --- Telnyx REST client (numbers, messaging, etc.) ---
export function getTelnyxClient(): Telnyx {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    throw new Error("Missing TELNYX_API_KEY")
  }
  return new Telnyx(apiKey)
}

// --- App URL (same as Twilio; used for webhook URLs in TeXML) ---
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.getzingapp.com"
}

// --- TeXML: use TwiML builder; Telnyx accepts TwiML-compatible XML ---
export const VoiceResponse = twilio.twiml.VoiceResponse

// --- Optional: validate Telnyx webhook signature (Ed25519) ---
// Telnyx sends headers: telnyx-timestamp, telnyx-signature-ed25519
// Set TELNYX_PUBLIC_KEY in env and use a library like @noble/ed25519 to verify.
export function validateTelnyxRequest(
  _payload: string,
  _signature: string,
  _timestamp: string
): boolean {
  // TODO: implement Ed25519 verification with TELNYX_PUBLIC_KEY
  // For now, rely on HTTPS and optional secret path tokens if needed.
  return true
}
