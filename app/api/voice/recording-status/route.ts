// ============================================
// POST /api/voice/recording-status
// ============================================
// Twilio Recording Status Callback.
// Updates call log with recording URL when available.

import { NextRequest, NextResponse } from "next/server"
import { updateCallLog } from "@/lib/db"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = parseInt(
    (formData.get("RecordingDuration") as string) || "0",
    10
  )
  const recordingStatus = formData.get("RecordingStatus") as string

  try {
    if (recordingStatus === "completed" && recordingUrl) {
      await updateCallLog(callSid, {
        has_recording: true,
        recording_url: `${recordingUrl}.mp3`,
        recording_duration_seconds: recordingDuration,
      })
    }
  } catch (error) {
    console.error("[Zing] Error in recording status callback:", error)
  }

  return new NextResponse("OK", { status: 200 })
}
