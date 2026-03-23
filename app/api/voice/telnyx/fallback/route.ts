// ============================================
// POST/GET /api/voice/telnyx/fallback
// ============================================
// Telnyx Dial `action` — prefers `/fallback/u/{userId}` (see incoming TeXML) so userId survives stripped query strings.

import { NextRequest } from "next/server"
import { handleTelnyxFallbackDialEnded } from "@/lib/telnyx-fallback-dial-action"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function POST(req: NextRequest) {
  return handleTelnyxFallbackDialEnded(req, null)
}

export async function GET(req: NextRequest) {
  return handleTelnyxFallbackDialEnded(req, null)
}
