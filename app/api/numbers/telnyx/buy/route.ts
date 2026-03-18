// ============================================
// POST /api/numbers/telnyx/buy
// ============================================
// Purchase a Telnyx phone number, configure it with our TeXML webhook,
// and save it to the database.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { insertPhoneNumber } from "@/lib/db"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  }
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.getzingapp.com"
}

// Find or create a TeXML application that points to our incoming call webhook
async function getOrCreateTexmlApp(): Promise<string> {
  const appUrl = getAppUrl()

  // Check if we already have a Zing TeXML app
  const listRes = await fetch(`${TELNYX_BASE}/texml_applications?page[size]=50`, {
    headers: authHeaders(),
  })
  const listBody = await listRes.json()
  const apps = listBody?.data || []
  const existing = apps.find((a: Record<string, string>) => a.friendly_name === "Zing Call Router")
  if (existing?.id) {
    return existing.id
  }

  // Create one
  const createRes = await fetch(`${TELNYX_BASE}/texml_applications`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      friendly_name: "Zing Call Router",
      voice_url: `${appUrl}/api/voice/telnyx/incoming`,
      voice_method: "POST",
      voice_fallback_url: `${appUrl}/api/voice/telnyx/incoming`,
      status_callback_url: `${appUrl}/api/voice/telnyx/status`,
      status_callback_method: "POST",
    }),
  })
  const createBody = await createRes.json()
  if (!createRes.ok) {
    const errMsg = createBody?.errors?.[0]?.detail || JSON.stringify(createBody)
    throw new Error(`Failed to create TeXML app: ${errMsg}`)
  }
  const appId = createBody?.data?.id
  if (!appId) throw new Error("TeXML app created but no ID returned")
  console.log(`[Zing] Created TeXML application: ${appId}`)
  return appId
}

// Assign a phone number to our TeXML application so calls route to our webhook
async function configureNumberVoice(phoneNumber: string, texmlAppId: string): Promise<void> {
  // First get the phone number's Telnyx ID
  const searchRes = await fetch(
    `${TELNYX_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}&page[size]=1`,
    { headers: authHeaders() }
  )
  const searchBody = await searchRes.json()
  const numberRecord = searchBody?.data?.[0]
  if (!numberRecord?.id) {
    console.error(`[Zing] Could not find Telnyx record for ${phoneNumber}`)
    return
  }

  // Update the number to use our TeXML application
  const patchRes = await fetch(`${TELNYX_BASE}/phone_numbers/${numberRecord.id}/voice`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      connection_id: texmlAppId,
      tech_prefix_enabled: false,
    }),
  })
  if (!patchRes.ok) {
    const patchBody = await patchRes.json().catch(() => ({}))
    console.error(`[Zing] Failed to configure voice for ${phoneNumber}:`, patchBody)
  } else {
    console.log(`[Zing] Voice configured for ${phoneNumber} → TeXML app ${texmlAppId}`)
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { phone_number } = body as { phone_number: string }

    if (!phone_number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    // Step 1: Purchase the number
    const res = await fetch(`${TELNYX_BASE}/number_orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        phone_numbers: [{ phone_number }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || "Purchase failed"
      console.error("[Telnyx] Buy error:", errMsg)
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const orderId = data?.data?.id || ""
    const boughtNumber = data?.data?.phone_numbers?.[0]?.phone_number || phone_number

    // Step 2: Configure the number with our TeXML webhook so calls route to the app
    try {
      const texmlAppId = await getOrCreateTexmlApp()
      await configureNumberVoice(boughtNumber, texmlAppId)
    } catch (configErr) {
      console.error("[Zing] Voice config failed (number still purchased):", configErr)
    }

    // Step 3: Save to database
    const saved = await insertPhoneNumber({
      user_id: userId,
      number: boughtNumber,
      friendly_name: boughtNumber,
      label: "Business Line",
      type: "local",
      status: "active",
      twilio_sid: orderId,
    })

    console.log(`[Zing] Number ${boughtNumber} purchased, configured, and saved (order: ${orderId}, db: ${saved.id})`)

    return NextResponse.json({
      success: true,
      number: {
        id: saved.id,
        telnyx_order_id: orderId,
        number: boughtNumber,
        friendly_name: boughtNumber,
      },
    })
  } catch (error) {
    console.error("[Telnyx] Error buying number:", error)
    return NextResponse.json(
      { error: "Failed to purchase number" },
      { status: 500 }
    )
  }
}
