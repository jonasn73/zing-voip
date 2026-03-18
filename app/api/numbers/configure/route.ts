// ============================================
// POST /api/numbers/configure
// ============================================
// Configures all of a user's existing phone numbers with the Zing TeXML
// webhook so calls route through the app. Run this once to fix numbers
// that were purchased before voice configuration was added.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getPhoneNumbers } from "@/lib/db"

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

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const appUrl = getAppUrl()
    const results: { number: string; status: string; error?: string }[] = []

    // Find or create TeXML app
    const listRes = await fetch(`${TELNYX_BASE}/texml_applications?page[size]=50`, {
      headers: authHeaders(),
    })
    const listBody = await listRes.json()
    const apps = listBody?.data || []
    let texmlAppId = apps.find((a: Record<string, string>) => a.friendly_name === "Zing Call Router")?.id

    if (!texmlAppId) {
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
      texmlAppId = createBody?.data?.id
      if (!texmlAppId) {
        return NextResponse.json({ error: "Failed to create TeXML app" }, { status: 500 })
      }
      results.push({ number: "TeXML App", status: `Created: ${texmlAppId}` })
    } else {
      results.push({ number: "TeXML App", status: `Exists: ${texmlAppId}` })
    }

    // Get user's numbers from DB
    const numbers = await getPhoneNumbers(userId)

    for (const num of numbers) {
      if (num.status !== "active") {
        results.push({ number: num.number, status: "skipped (not active)" })
        continue
      }

      try {
        // Find the Telnyx phone number record
        const searchRes = await fetch(
          `${TELNYX_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(num.number)}&page[size]=1`,
          { headers: authHeaders() }
        )
        const searchBody = await searchRes.json()
        const record = searchBody?.data?.[0]

        if (!record?.id) {
          results.push({ number: num.number, status: "error", error: "Not found in Telnyx" })
          continue
        }

        // Configure voice
        const patchRes = await fetch(`${TELNYX_BASE}/phone_numbers/${record.id}/voice`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            connection_id: texmlAppId,
            tech_prefix_enabled: false,
          }),
        })

        if (patchRes.ok) {
          results.push({ number: num.number, status: "configured" })
        } else {
          const patchBody = await patchRes.json().catch(() => ({}))
          results.push({ number: num.number, status: "error", error: patchBody?.errors?.[0]?.detail || `HTTP ${patchRes.status}` })
        }
      } catch (err) {
        results.push({ number: num.number, status: "error", error: String(err) })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error("[Zing] Configure numbers error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
