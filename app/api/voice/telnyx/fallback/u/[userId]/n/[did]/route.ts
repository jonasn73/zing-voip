// ============================================
// POST/GET /api/voice/telnyx/fallback/u/{userId}/n/{did}
// ============================================
// Business DID digits live in the path so Telnyx cannot drop them (query strings are often truncated).
// Example: .../fallback/u/<uuid>/n/12125551234?callSid=...&primary=owner&fb=ai

import { NextRequest } from "next/server"
import { handleTelnyxFallbackDialEnded } from "@/lib/telnyx-fallback-dial-action"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

type RouteCtx = { params: Promise<{ userId: string; did: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { userId, did } = await ctx.params
  return handleTelnyxFallbackDialEnded(req, userId, { pathDidDigits: did })
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { userId, did } = await ctx.params
  return handleTelnyxFallbackDialEnded(req, userId, { pathDidDigits: did })
}
