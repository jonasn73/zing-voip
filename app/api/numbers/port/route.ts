// ============================================
// POST /api/numbers/port
// ============================================
// Full porting flow:
//   1. Check portability
//   2. Create draft port order
//   3. Fill end-user info + service address
//   4. Check & fulfill requirements (LOA, etc.)
//   5. Confirm (submit) the order
// The customer fills out a form in the app and the port is submitted automatically.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  }
}

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return raw.startsWith("+") ? raw : `+${digits}`
}

// Generic Telnyx API helper — throws on non-2xx with the actual Telnyx error message
async function telnyxFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  })
  const body = await res.json()
  if (!res.ok) {
    const errMsg =
      body?.errors?.[0]?.detail ||
      body?.errors?.[0]?.title ||
      body?.message ||
      JSON.stringify(body)
    throw new Error(`Telnyx ${res.status}: ${errMsg}`)
  }
  return body
}

// Fetch raw binary (for LOA PDF template download)
async function telnyxFetchRaw(path: string): Promise<Buffer> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })
  if (!res.ok) throw new Error(`Telnyx ${res.status} fetching ${path}`)
  const arrayBuf = await res.arrayBuffer()
  return Buffer.from(arrayBuf)
}

// Upload a document (PDF) to Telnyx and return the document ID
async function uploadDocument(pdfBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([pdfBuffer], { type: "application/pdf" })
  formData.append("file", blob, filename)

  const res = await fetch(`${TELNYX_BASE}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: formData,
  })
  const body = await res.json()
  if (!res.ok) {
    const errMsg = body?.errors?.[0]?.detail || JSON.stringify(body)
    throw new Error(`Document upload failed: ${errMsg}`)
  }
  return body?.data?.id
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

    // ── Step 1: Check portability ──
    let fastPortable = false
    try {
      const portCheck = await telnyxFetch("/portability_checks", {
        method: "POST",
        body: JSON.stringify({ phone_numbers: [e164] }),
      })
      const entry = portCheck?.data?.[0] || {}
      if (entry.portable === false) {
        return NextResponse.json({
          error: `This number can't be ported: ${entry.not_portable_reason || "unknown reason"}. Contact your current carrier.`,
        }, { status: 400 })
      }
      fastPortable = entry.fast_portable === true
    } catch {
      // Portability check is optional — continue even if it fails
    }

    // ── Step 2: Create draft port order ──
    // Telnyx returns { data: [ ...orders ] } — an array, even for a single number
    const createRes = await telnyxFetch("/porting_orders", {
      method: "POST",
      body: JSON.stringify({ phone_numbers: [e164] }),
    })

    const ordersArr = createRes?.data
    const orderId: string | undefined = Array.isArray(ordersArr) ? ordersArr[0]?.id : ordersArr?.id
    if (!orderId) {
      console.error("[Zing] Unexpected create response:", JSON.stringify(createRes).slice(0, 500))
      return NextResponse.json({ error: "Failed to create port order" }, { status: 500 })
    }
    console.log(`[Zing] Port order created: ${orderId} for ${e164}`)

    // ── Step 3: Fill end-user info + service address ──
    await telnyxFetch(`/porting_orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({
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
      }),
    })
    console.log(`[Zing] End-user info filled for order ${orderId}`)

    // ── Step 4: Check & fulfill requirements (LOA, invoice, etc.) ──
    let loaFulfilled = false
    try {
      const reqRes = await telnyxFetch(`/porting_orders/${orderId}/requirements`)
      const requirements = reqRes?.data || []

      for (const req of requirements) {
        const status = req.requirement_status || ""
        const fieldType = req.field_type || req.requirement_type?.type || ""
        const reqTypeId = req.requirement_type?.id
        const reqName = (req.requirement_type?.name || "").toLowerCase()

        // Skip already-approved requirements
        if (status === "approved") continue

        // Handle LOA document requirement — auto-generate from Telnyx template
        if (fieldType === "document" && reqName.includes("loa")) {
          try {
            const loaPdf = await telnyxFetchRaw(`/porting_orders/${orderId}/loa_template`)
            const docId = await uploadDocument(loaPdf, `loa-${orderId}.pdf`)
            console.log(`[Zing] LOA uploaded as document ${docId}`)

            // Fulfill the LOA requirement on the order
            if (reqTypeId && docId) {
              await telnyxFetch(`/porting_orders/${orderId}`, {
                method: "PATCH",
                body: JSON.stringify({
                  documents: { loa: docId },
                }),
              })
              loaFulfilled = true
              console.log(`[Zing] LOA requirement fulfilled for order ${orderId}`)
            }
          } catch (loaErr) {
            console.error("[Zing] LOA auto-fulfill failed:", loaErr instanceof Error ? loaErr.message : loaErr)
          }
        }

        // Handle invoice requirement — skip for now (many carriers don't require it)
        if (fieldType === "document" && reqName.includes("invoice")) {
          console.log(`[Zing] Invoice requirement exists for order ${orderId} — skipping (optional for most carriers)`)
        }
      }
    } catch (reqErr) {
      console.error("[Zing] Requirements check failed:", reqErr instanceof Error ? reqErr.message : reqErr)
    }

    // ── Step 5: Confirm (submit) the port order ──
    // The correct endpoint is /actions/confirm, not /actions/submit
    let submitStatus = "submitted"
    try {
      const confirmRes = await telnyxFetch(`/porting_orders/${orderId}/actions/confirm`, {
        method: "POST",
      })
      const confirmData = confirmRes?.data
      submitStatus = (Array.isArray(confirmData) ? confirmData[0]?.porting_order_status : confirmData?.porting_order_status) || "in-process"
      console.log(`[Zing] Port order ${orderId} confirmed, status: ${submitStatus}`)
    } catch (confirmErr: unknown) {
      const msg = confirmErr instanceof Error ? confirmErr.message : String(confirmErr)
      console.error(`[Zing] Port order ${orderId} confirm failed: ${msg}`)

      // Return success with draft status — the order exists, just needs manual attention
      return NextResponse.json({
        success: true,
        status: "draft",
        message: loaFulfilled
          ? "Port order created and documents submitted. Final confirmation is pending — we'll notify you when the transfer begins."
          : `Port order created but needs additional steps before it can be confirmed. Reason: ${msg.replace(/^Telnyx \d+:\s*/, "")}`,
        port: { number: e164, port_order_id: orderId, telnyx_status: "draft" },
      })
    }

    return NextResponse.json({
      success: true,
      status: submitStatus,
      message: "Your number is being transferred to Zing. This usually takes 1-3 business days. Check Settings for progress.",
      port: {
        number: e164,
        port_order_id: orderId,
        telnyx_status: submitStatus,
        fast_port: fastPortable,
      },
    })
  } catch (error: unknown) {
    console.error("[Zing] Port request error:", error)
    const msg = error instanceof Error ? error.message : String(error)

    if (/feature not permitted|not permitted|10038/i.test(msg)) {
      return NextResponse.json({
        error: "Number porting isn't available on your current plan. Please contact support.",
      }, { status: 403 })
    }
    if (/portab|not portable|invalid number/i.test(msg)) {
      return NextResponse.json({ error: `This number may not be portable: ${msg}` }, { status: 400 })
    }
    return NextResponse.json({ error: msg || "Failed to submit port request" }, { status: 500 })
  }
}
