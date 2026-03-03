// ============================================
// POST /api/admin/configure-porting-webhook
// ============================================
// One-time setup: configures Twilio to send port-in status to our webhook.
// Call once per environment after deploy. Protected by PORTING_WEBHOOK_SECRET.

import { NextRequest, NextResponse } from "next/server"
import { getAppUrl } from "@/lib/twilio"
import { configurePortingWebhook } from "@/lib/twilio-porting"

const SECRET = process.env.PORTING_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "Set PORTING_WEBHOOK_SECRET in env to use this endpoint." },
      { status: 501 }
    )
  }

  const auth = req.headers.get("authorization")
  const expected = `Bearer ${SECRET}`
  if (auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const appUrl = getAppUrl()
    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/numbers/porting-webhook`
    await configurePortingWebhook(webhookUrl)
    return NextResponse.json({
      success: true,
      message: "Porting webhook configured.",
      port_in_target_url: webhookUrl,
    })
  } catch (error) {
    console.error("[Zing] Configure porting webhook error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Configuration failed" },
      { status: 500 }
    )
  }
}
