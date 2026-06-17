// ============================================
// POST /api/numbers/configure
// ============================================
// Auto-configures ALL of a user's phone numbers with the lyncr TeXML webhook.
// This runs silently on every settings page load to ensure:
//   1. Numbers purchased before auto-config was added still work
//   2. Ported numbers that completed get wired up
//   3. Any number that lost its webhook config gets fixed
//   4. The TeXML app has an outbound voice profile (required for Dial)
// Also syncs Telnyx numbers into the local DB if missing.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import {
  getPhoneNumbers,
  insertPhoneNumber,
  getPhoneNumberByNumberAndStatus,
  normalizePhoneNumberE164,
} from "@/lib/db"
import {
  telnyxHeaders,
  getOrCreateTexmlApp,
} from "@/lib/telnyx-config"
import { listTelnyxAccountPhoneNumbers } from "@/lib/telnyx-number-sync"

const TELNYX_BASE = "https://api.telnyx.com/v2"

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const results: { number: string; action: string }[] = []

    // Step 1: Find or create the lyncr Call Router TeXML app (with outbound voice profile)
    const texmlAppId = await getOrCreateTexmlApp()

    const telnyxNumbers = await listTelnyxAccountPhoneNumbers()

    const dbNumbers = await getPhoneNumbers(userId)
    const dbDigitSet = new Set(dbNumbers.map((n) => normalizePhoneNumberE164(n.number).replace(/\D/g, "")))

    for (const tn of telnyxNumbers) {
      if (!tn.phone_number) continue
      const e164 = normalizePhoneNumberE164(tn.phone_number)
      const digitKey = e164.replace(/\D/g, "")

      if (digitKey && !dbDigitSet.has(digitKey)) {
        const existingInDb = await getPhoneNumberByNumberAndStatus(e164, "active")
        if (!existingInDb) {
          await insertPhoneNumber({
            user_id: userId,
            number: e164,
            friendly_name: e164,
            label: "Business Line",
            type: "local",
            status: "active",
            provider_number_sid: tn.id,
          })
          results.push({ number: e164, action: "added to database" })
          dbDigitSet.add(digitKey)
        }
      }

      // Configure voice if not pointing to our TeXML app
      if (tn.connection_id !== texmlAppId) {
        const patchRes = await fetch(`${TELNYX_BASE}/phone_numbers/${tn.id}/voice`, {
          method: "PATCH",
          headers: telnyxHeaders(),
          body: JSON.stringify({ connection_id: texmlAppId, tech_prefix_enabled: false }),
        })
        if (patchRes.ok) {
          results.push({ number: tn.phone_number, action: "voice configured" })
        } else {
          const patchBody = await patchRes.json().catch(() => ({}))
          results.push({ number: tn.phone_number, action: `config failed: ${patchBody?.errors?.[0]?.detail || patchRes.status}` })
        }
      } else {
        results.push({ number: tn.phone_number, action: "already configured" })
      }
    }

    return NextResponse.json({ success: true, configured: results.length, results })
  } catch (error) {
    console.error("[Sigo] Configure numbers error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
