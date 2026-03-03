// ============================================
// POST /api/voice/status
// ============================================
// Twilio Call Status Callback. Updates call log with final duration, status.

import { NextRequest, NextResponse } from "next/server"
import { updateCallLog } from "@/lib/db"
import type { CallType } from "@/lib/types"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const callStatus = formData.get("CallStatus") as string
  const duration = parseInt((formData.get("CallDuration") as string) || "0", 10)
  const direction = formData.get("Direction") as string

  try {
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

  return new NextResponse("OK", { status: 200 })
}
