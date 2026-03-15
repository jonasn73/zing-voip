// ============================================
// POST /api/voice/telnyx/recording-status
// ============================================
// Telnyx recording status callback. Updates the call log with recording URL/duration.
// Same behavior as Twilio recording-status; param names may match TeXML docs.

import { NextRequest, NextResponse } from "next/server"
import { updateCallLog } from "@/lib/db"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = (formData.get("CallSid") as string) || ""
  const recordingUrl =
    (formData.get("RecordingUrl") as string) || (formData.get("RecordingURL") as string) || ""
  const recordingDuration = parseInt(
    (formData.get("RecordingDuration") as string) || "0",
    10
  )
  const recordingStatus = (formData.get("RecordingStatus") as string) || ""

  try {
    if (recordingStatus === "completed" && recordingUrl) {
      await updateCallLog(callSid, {
        has_recording: true,
        recording_url: recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`,
        recording_duration_seconds: recordingDuration,
      })
    }
  } catch (error) {
    console.error("[Telnyx] Error in recording status callback:", error)
  }

  return new NextResponse("OK", { status: 200 })
}
