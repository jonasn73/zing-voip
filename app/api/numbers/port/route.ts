// ============================================
// POST /api/numbers/port
// ============================================
// Full porting flow: check portability → create draft → fill end-user info → submit.
// The customer fills out a form in the app and the port is submitted automatically.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return raw.startsWith("+") ? raw : `+${digits}`
}

async function telnyxFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...options.headers,
    },
  })
  const body = await res.json()
  if (!res.ok) {
    const errMsg = body?.errors?.[0]?.detail || body?.errors?.[0]?.title || JSON.stringify(body)
    throw new Error(`Telnyx ${res.status}: ${errMsg}`)
  }
  return body
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      number,
      account_name,
      authorized_person,
      account_number,
      pin,
      street_address,
      city,
      state,
      zip,
    } = body as {
      number: string
      account_name: string
      authorized_person: string
      account_number?: string
      pin?: string
      street_address: string
      city: string
      state: string
      zip: string
    }

    if (!number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    if (!account_name || !authorized_person) {
      return NextResponse.json({ error: "Account name and authorized person are required" }, { status: 400 })
    }
    if (!street_address || !city || !state || !zip) {
      return NextResponse.json({ error: "Full service address is required" }, { status: 400 })
    }

    const e164 = toE164(number)

    // --- Step 1: Check portability ---
    let portabilityResult: { portable: boolean; not_portable_reason?: string; fast_portable?: boolean }
    try {
      const portCheck = await telnyxFetch("/portability_checks", {
        method: "POST",
        body: JSON.stringify({ phone_numbers: [e164] }),
      })
      const entry = portCheck?.data?.[0] || {}
      portabilityResult = {
        portable: entry.portable === true,
        not_portable_reason: entry.not_portable_reason || undefined,
        fast_portable: entry.fast_portable === true,
      }
    } catch {
      // If portability check fails, continue with creation (it will fail later if not portable)
      portabilityResult = { portable: true }
    }

    if (!portabilityResult.portable) {
      return NextResponse.json({
        error: `This number can't be ported: ${portabilityResult.not_portable_reason || "unknown reason"}. Contact your current carrier for details.`,
      }, { status: 400 })
    }

    // --- Step 2: Create draft port order ---
    // Telnyx returns { data: [ ...orders ] } — an array, even for a single number
    const createRes = await telnyxFetch("/porting_orders", {
      method: "POST",
      body: JSON.stringify({ phone_numbers: [e164] }),
    })

    const orders = createRes?.data
    const orderId = Array.isArray(orders) ? orders[0]?.id : orders?.id
    if (!orderId) {
      console.error("[Zing] Unexpected create response:", JSON.stringify(createRes).slice(0, 500))
      return NextResponse.json({ error: "Failed to create port order — unexpected response from carrier" }, { status: 500 })
    }

    // --- Step 3: Fill in end-user info and service address ---
    const updateBody: Record<string, unknown> = {
      end_user: {
        admin: {
          entity_name: account_name,
          auth_person_name: authorized_person,
          account_number: account_number || undefined,
          pin: pin || undefined,
        },
        location: {
          street_address,
          locality: city,
          administrative_area: state,
          postal_code: zip,
          country_code: "US",
        },
      },
      customer_reference: `zing-${userId}`,
    }

    await telnyxFetch(`/porting_orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(updateBody),
    })

    // --- Step 4: Submit the port order ---
    let submitStatus = "submitted"
    try {
      const submitRes = await telnyxFetch(`/porting_orders/${orderId}/actions/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      submitStatus = submitRes?.data?.porting_order_status || "in-process"
    } catch (submitErr: unknown) {
      // If submit fails (e.g. missing LOA requirement), return the order ID so user can track it
      const msg = submitErr instanceof Error ? submitErr.message : String(submitErr)
      console.error("[Zing] Port order created but submit failed:", msg)

      // Check if it's a requirements issue (LOA/invoice needed)
      if (/requirement|loa|document|invoice/i.test(msg)) {
        return NextResponse.json({
          success: true,
          status: "draft",
          message: "Port order created. Your carrier may require additional verification. We'll follow up via email if anything else is needed.",
          port: { number: e164, port_order_id: orderId, telnyx_status: "draft" },
        })
      }
      return NextResponse.json({
        success: true,
        status: "draft",
        message: "Port order created but couldn't be submitted automatically. We'll follow up to complete the transfer.",
        port: { number: e164, port_order_id: orderId, telnyx_status: "draft" },
      })
    }

    return NextResponse.json({
      success: true,
      status: submitStatus,
      message: "Your number is being transferred to Zing. This usually takes 1–3 business days. Check Settings for progress.",
      port: {
        number: e164,
        port_order_id: orderId,
        telnyx_status: submitStatus,
        fast_port: portabilityResult.fast_portable || false,
      },
    })
  } catch (error: unknown) {
    console.error("[Zing] Port request error:", error)
    const msg = error instanceof Error ? error.message : String(error)

    if (/feature not permitted|not permitted|10038/i.test(msg)) {
      return NextResponse.json({
        error: "Number porting isn't available on your current plan. Please contact support.",
        code: "feature_not_permitted",
      }, { status: 403 })
    }
    if (/portab|not portable|invalid number/i.test(msg)) {
      return NextResponse.json({ error: `This number may not be portable: ${msg}` }, { status: 400 })
    }
    return NextResponse.json({ error: msg || "Failed to submit port request" }, { status: 500 })
  }
}
