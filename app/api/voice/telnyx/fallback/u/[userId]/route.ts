// ============================================
// POST/GET /api/voice/telnyx/fallback/u/{userId}
// ============================================
// Same as /fallback but userId is in the path so Telnyx cannot drop it from the Dial action URL.

import { NextRequest } from "next/server"
import { handleTelnyxFallbackDialEnded } from "@/lib/telnyx-fallback-dial-action"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

type RouteCtx = { params: Promise<{ userId: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { userId } = await ctx.params
  return handleTelnyxFallbackDialEnded(req, userId)
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { userId } = await ctx.params
  return handleTelnyxFallbackDialEnded(req, userId)
}
