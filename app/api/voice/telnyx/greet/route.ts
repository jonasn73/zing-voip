// Pass-1 inbound — Edge-only instant `<Redirect>` (answers call before Node cold start).
import { NextRequest, NextResponse } from "next/server"
import {
  buildEdgeInboundGreetingContinueUrl,
  buildEdgeInstantGreetingTexml,
} from "@/lib/inbound-instant-greet-edge"

export const runtime = "edge"

function instantGreetingResponse(req: NextRequest): NextResponse {
  const continueUrl = buildEdgeInboundGreetingContinueUrl(req.url)
  const xml = buildEdgeInstantGreetingTexml(continueUrl)
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

export function GET(req: NextRequest) {
  return instantGreetingResponse(req)
}

export function POST(req: NextRequest) {
  return instantGreetingResponse(req)
}
