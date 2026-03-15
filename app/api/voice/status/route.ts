// ============================================
// POST /api/voice/status
// ============================================
// Twilio Call Status Callback.
// Updates the call log with final duration, status, etc.
// Configure this URL in your Twilio number's "Status Callback URL"

import { NextRequest, NextResponse } from "next/server"
import { updateCallLog } from "@/lib/db"
import type { CallType } from "@/lib/types"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const callStatus = formData.get("CallStatus") as string // completed, no-answer, busy, failed
  const duration = parseInt((formData.get("CallDuration") as string) || "0", 10)
  const direction = formData.get("Direction") as string

  try {
    // Determine call type from status
    let callType: CallType = "incoming"
    if (direction === "outbound-api" || direction === "outbound-dial") {
      callType = "outgoing"
    } else if (callStatus === "no-answer" || callStatus === "busy") {
      callType = "missed"
    }

    await updateCallLog(callSid, {
      status: callStatus,
      duration_seconds: duration,
      call_type: callType,
    })
  } catch (error) {
    console.error("[Zing] Error in status callback:", error)
  }

  // Twilio expects 200 OK
  return new NextResponse("OK", { status: 200 })
}
