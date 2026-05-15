// ============================================
// Public product identity (UI + metadata)
// ============================================
// Env vars like ZING_ADMIN_EMAILS and cookie `zing_session` stay as-is for production compatibility.

/** Visible product name in the app shell, marketing, and help stories (“Hey” = the greeting callers feel). */
export const SITE_NAME = "Hey Sigo"

/**
 * One-line positioning: ties the name to routing value (Spanish “sigo” ≈ I follow / I continue — your line follows you).
 */
export const SITE_TAGLINE = "Say hey to business calls that follow you."

/** Short narrative for help / onboarding where a little brand color helps (plain text; no HTML). */
export const SITE_BRAND_STORY =
  "We call the product Hey Sigo because your business line should feel like a friendly hello—then quietly route every caller to the right person, backup, or AI without you wrestling a phone system."

/** Default meta description for SEO and share cards. */
export const SITE_DESCRIPTION =
  "Hey Sigo helps you buy or port a business number, route calls to your team or cell, and set voicemail, AI, or owner fallback—so nothing falls through the cracks."

/** Canonical site URL (update when the domain moves off getzingapp.com). */
export const SITE_CANONICAL_URL = "https://www.getzingapp.com"

/** Browser tab title template segment (after page title). */
export const SITE_TITLE_TEMPLATE_SUFFIX = SITE_NAME

/** Default full document title. */
export const SITE_METADATA_DEFAULT_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

/** Prior product / code names — useful for SEO `alternateName` and legacy log searches. */
export const SITE_ALTERNATE_NAMES = ["Sigo", "Zing"] as const

export const SITE_KEYWORDS = [
  "Hey Sigo",
  "Sigo",
  "business phone",
  "call routing",
  "virtual receptionist",
  "VoIP routing",
  "small business phone",
  "number porting",
  "AI phone assistant",
] as const
