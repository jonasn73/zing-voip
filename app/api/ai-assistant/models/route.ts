// ============================================
// GET /api/ai-assistant/models
// ============================================
// Lists Telnyx LLM ids for the Advanced AI model picker.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listTelnyxAiModels } from "@/lib/telnyx-ai-catalog"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const models = await listTelnyxAiModels()
    return NextResponse.json({ models, source: "telnyx" })
  } catch (e) {
    console.error("[GET /api/ai-assistant/models]", e)
    return NextResponse.json({ models: [], source: "telnyx", error: "Could not load models" }, { status: 200 })
  }
}
