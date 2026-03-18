// ============================================
// GET /api/voice/debug?number=+15025199741
// ============================================
// Debug endpoint to test what TeXML the incoming webhook would return
// for a given phone number. Shows the full routing logic step by step.

import { NextRequest, NextResponse } from "next/server"
import { VoiceResponse, getAppUrl } from "@/lib/telnyx"
import {
  getUserByPhoneNumber,
  getRoutingConfigForNumber,
  getReceptionist,
  getPhoneNumbers,
} from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  const url = new URL(req.url)
  const number = url.searchParams.get("number") || "+15025199741"
  const appUrl = getAppUrl()

  const steps: { step: string; result: unknown }[] = []

  // Step 1: Look up user by phone number
  const user = await getUserByPhoneNumber(number).catch((e) => {
    steps.push({ step: "getUserByPhoneNumber ERROR", result: String(e) })
    return null
  })
  steps.push({ step: "getUserByPhoneNumber", result: user ? { id: user.id, name: user.name, phone: user.phone } : null })

  if (!user) {
    // Also show what numbers the logged-in user has
    if (userId) {
      const nums = await getPhoneNumbers(userId).catch(() => [])
      steps.push({ step: "logged-in user's numbers", result: nums.map((n) => ({ number: n.number, status: n.status })) })
    }
    return NextResponse.json({ number, steps, texml: "User not found — call would say 'not configured' and hang up" })
  }

  // Step 2: Get routing config
  const config = await getRoutingConfigForNumber(user.id, number).catch((e) => {
    steps.push({ step: "getRoutingConfigForNumber ERROR", result: String(e) })
    return null
  })
  steps.push({
    step: "getRoutingConfigForNumber",
    result: config
      ? {
          selected_receptionist_id: config.selected_receptionist_id,
          fallback_type: config.fallback_type,
          ring_timeout_seconds: config.ring_timeout_seconds,
          business_number: config.business_number,
        }
      : null,
  })

  // Step 3: Get receptionist if one is selected
  let receptionist = null
  if (config?.selected_receptionist_id) {
    receptionist = await getReceptionist(config.selected_receptionist_id).catch((e) => {
      steps.push({ step: "getReceptionist ERROR", result: String(e) })
      return null
    })
    steps.push({ step: "getReceptionist", result: receptionist ? { id: receptionist.id, name: receptionist.name, phone: receptionist.phone } : null })
  }

  // Step 4: Build TeXML
  const texml = new VoiceResponse()
  if (receptionist) {
    const dial = texml.dial({
      timeout: config?.ring_timeout_seconds || 20,
      record: "record-from-answer-dual",
      recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
      action: `${appUrl}/api/voice/telnyx/fallback?userId=${user.id}&callSid=test`,
      method: "POST",
    })
    dial.number(receptionist.phone)
    steps.push({ step: "routing", result: `Dialing receptionist ${receptionist.name} at ${receptionist.phone}` })
  } else {
    const dial = texml.dial({
      timeout: 30,
      record: "record-from-answer-dual",
      recordingStatusCallback: `${appUrl}/api/voice/telnyx/recording-status`,
    })
    dial.number(user.phone)
    steps.push({ step: "routing", result: `Dialing owner at ${user.phone}` })
  }

  return NextResponse.json({ number, steps, texml: texml.toString() })
}
