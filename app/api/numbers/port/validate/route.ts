// GET /api/numbers/port/validate — pre-flight check for LNP port (workspace service address).

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUser } from "@/lib/db"
import {
  PORT_ADDRESS_ERROR_CODE,
  PORT_ADDRESS_ERROR_MESSAGE,
  validatePortServiceAddress,
} from "@/lib/port-address-validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await getUser(userId)
  if (!user || user.account_role !== "owner") {
    return NextResponse.json({ error: "Only business owners can port numbers" }, { status: 403 })
  }

  try {
    const organizationId = req.nextUrl.searchParams.get("organization_id")
    const result = await validatePortServiceAddress(userId, organizationId)

    return NextResponse.json({
      data: {
        ready: result.ok,
        organization_id: result.organization_id,
        missing_fields: result.missing_fields,
        address: result.address,
        source: result.source,
        error_code: result.ok ? null : PORT_ADDRESS_ERROR_CODE,
        error: result.ok ? null : PORT_ADDRESS_ERROR_MESSAGE,
      },
    })
  } catch (e) {
    console.error("[GET /api/numbers/port/validate]", e)
    return NextResponse.json({ error: "Could not validate port requirements" }, { status: 500 })
  }
}
