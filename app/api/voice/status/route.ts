// Legacy compatibility route.
// Canonical implementation lives in /api/voice/telnyx/status.
import { NextRequest } from "next/server"
import { POST as telnyxPOST } from "@/app/api/voice/telnyx/status/route"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function POST(req: NextRequest) {
  return telnyxPOST(req)
}
