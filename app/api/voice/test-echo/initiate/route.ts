// POST /api/voice/test-echo/initiate — authenticated dial-out to the owner's cell for audio diagnostics.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getPhoneNumbers, getUser, normalizePhoneNumberE164 } from "@/lib/db"
import { getAppUrl } from "@/lib/telnyx"
import { initiateTexmlOutboundCall } from "@/lib/telnyx-outbound-texml-call"

export const runtime = "nodejs"
export const preferredRegion = "iad1"

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { business_number?: string }
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const ownerPhoneRaw = user.phone?.trim()
    if (!ownerPhoneRaw) {
      return NextResponse.json(
        {
          error: "Add your mobile number in Settings before running an audio test.",
        },
        { status: 400 }
      )
    }

    const numbers = await getPhoneNumbers(userId)
    const activeNumbers = numbers.filter((n) => n.status === "active" && n.number?.trim())
    if (activeNumbers.length === 0) {
      return NextResponse.json(
        { error: "Activate a business line before running an audio test." },
        { status: 400 }
      )
    }

    const requested = body.business_number?.trim()
    const fromRecord =
      (requested &&
        activeNumbers.find(
          (n) => normalizePhoneNumberE164(n.number) === normalizePhoneNumberE164(requested)
        )) ||
      activeNumbers[0]

    const fromE164 = normalizePhoneNumberE164(fromRecord.number)
    const toE164 = normalizePhoneNumberE164(ownerPhoneRaw)
    const instructionUrl = `${getAppUrl()}/api/voice/test-echo`

    const call = await initiateTexmlOutboundCall({
      fromE164,
      toE164,
      instructionUrl,
    })

    return NextResponse.json({
      data: {
        status: call.call_status,
        dialed: toE164,
        from: fromE164,
        message: "Audio test call queued. Answer your phone to begin the Lyncr quality check.",
      },
    })
  } catch (e) {
    console.error("[voice/test-echo/initiate POST]", e)
    const msg = e instanceof Error ? e.message : "Could not start audio test call"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
