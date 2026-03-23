// ============================================
// POST/GET /api/voice/telnyx/fallback/u/{userId}/n/{did}/{mode}
// ============================================
// mode: recv | recv-ai | owner | owner-ai — in the path so Telnyx cannot strip query flags.
// owner-ai / recv-ai mean "this line uses Voice AI after no-answer" (same as fb=ai on query).

import { NextRequest } from "next/server"
import { handleTelnyxFallbackDialEnded, type TelnyxFallbackPathOpts } from "@/lib/telnyx-fallback-dial-action"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

type RouteCtx = { params: Promise<{ userId: string; did: string; mode: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { userId, did, mode } = await ctx.params
  const opts: TelnyxFallbackPathOpts = { pathDidDigits: did, pathFallbackMode: mode }
  return handleTelnyxFallbackDialEnded(req, userId, opts)
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { userId, did, mode } = await ctx.params
  const opts: TelnyxFallbackPathOpts = { pathDidDigits: did, pathFallbackMode: mode }
  return handleTelnyxFallbackDialEnded(req, userId, opts)
}
