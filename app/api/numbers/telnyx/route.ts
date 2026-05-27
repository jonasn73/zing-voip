// ============================================
// GET /api/numbers/telnyx
// ============================================
// Search available Telnyx phone numbers by area code (US).
// Returns a list of numbers you can then buy via POST /api/numbers/telnyx/buy

import { NextRequest, NextResponse } from "next/server"

const TELNYX_BASE = "https://api.telnyx.com/v2"

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error("Missing TELNYX_API_KEY")
  return key
}

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const areaCode = searchParams.get("area_code") || "212"
    const type = searchParams.get("type") || "local"
    const contains = (searchParams.get("contains") || "").replace(/\D/g, "").slice(-4)
    const endsWith = (searchParams.get("ends_with") || "").replace(/\D/g, "").slice(-4)
    const startsWith = (searchParams.get("starts_with") || "").replace(/\D/g, "")
    const pageRaw = Number.parseInt(searchParams.get("page") || "1", 10)
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1
    const pageSizeRaw = Number.parseInt(searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE), 10)
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
        ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE

    // Build Telnyx query params
    const params = new URLSearchParams({
      "filter[country_code]": "US",
      "filter[national_destination_code]": areaCode,
      "filter[phone_number_type]": type === "toll_free" ? "toll_free" : "local",
      "filter[features][]": "voice",
      // Telnyx allows up to 250; we paginate so the UI can load more without re-searching.
      "filter[limit]": "250",
      "filter[best_effort]": "false",
      "page[size]": String(pageSize),
      "page[number]": String(page),
    })
    if (contains.length >= 2) {
      params.set("filter[phone_number][contains]", contains)
    }
    if (endsWith.length >= 2) {
      params.set("filter[phone_number][ends_with]", endsWith)
    }
    if (startsWith.length >= 2) {
      params.set("filter[phone_number][starts_with]", startsWith)
    }

    const res = await fetch(`${TELNYX_BASE}/available_phone_numbers?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
    })

    const body = await res.json()

    if (!res.ok) {
      const errMsg = body?.errors?.[0]?.detail || body?.errors?.[0]?.title || `HTTP ${res.status}`
      console.error("[Telnyx] Number search error:", errMsg)
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const rawNumbers = body?.data || []

    const numbers = rawNumbers.map((item: Record<string, unknown>) => ({
      number: item.phone_number || "",
      friendly_name: item.phone_number || "",
      type: type,
      monthly_cost: (item.cost_information as Record<string, unknown>)?.monthly_cost ?? 1.0,
    }))

    const metaRaw = (body?.meta ?? {}) as Record<string, unknown>
    const totalResults = Number(metaRaw.total_results ?? numbers.length)
    const totalPages = Number(metaRaw.total_pages ?? (numbers.length > 0 ? 1 : 0))
    const pageNumber = Number(metaRaw.page_number ?? page)
    const metaPageSize = Number(metaRaw.page_size ?? pageSize)
    const hasMore =
      totalPages > 0
        ? pageNumber < totalPages
        : numbers.length >= pageSize

    return NextResponse.json({
      numbers,
      meta: {
        page: pageNumber,
        page_size: metaPageSize,
        total_results: Number.isFinite(totalResults) ? totalResults : numbers.length,
        total_pages: Number.isFinite(totalPages) ? totalPages : numbers.length > 0 ? 1 : 0,
        has_more: hasMore,
      },
    })
  } catch (error) {
    console.error("[Telnyx] Error searching numbers:", error)
    return NextResponse.json(
      { error: "Failed to search available numbers" },
      { status: 500 }
    )
  }
}
