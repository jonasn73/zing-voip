// Legacy compatibility route.
// Canonical implementation lives in /api/voice/telnyx/fallback.
import { NextRequest } from "next/server"
import { POST as telnyxPOST, GET as telnyxGET } from "@/app/api/voice/telnyx/fallback/route"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function POST(req: NextRequest) {
  return telnyxPOST(req)
}

export async function GET(req: NextRequest) {
  return telnyxGET(req)
}
