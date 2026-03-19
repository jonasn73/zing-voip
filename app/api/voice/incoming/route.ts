// Legacy compatibility route.
// Canonical implementation lives in /api/voice/telnyx/incoming.
import { NextRequest } from "next/server"
import {
  GET as telnyxGET,
  POST as telnyxPOST,
} from "@/app/api/voice/telnyx/incoming/route"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function GET(req: NextRequest) {
  return telnyxGET(req)
}

export async function POST(req: NextRequest) {
  return telnyxPOST(req)
}
