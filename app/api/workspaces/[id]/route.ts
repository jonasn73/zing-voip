// PATCH /api/workspaces/[id] — rename a business workspace
// DELETE /api/workspaces/[id] — release lines, remove routing, delete workspace

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import {
  deleteOrganizationForOwner,
  getUser,
  listOrganizationsForOwner,
  updateOrganizationNameForOwner,
} from "@/lib/db"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

async function requireOwner(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const user = await getUser(userId)
  if (!user || user.account_role !== "owner") {
    return NextResponse.json({ error: "Only business owners can manage workspaces" }, { status: 403 })
  }
  return userId
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const userId = await requireOwner(req)
  if (userId instanceof NextResponse) return userId

  const { id } = await ctx.params
  const workspaceId = String(id ?? "").trim()
  if (!workspaceId) return NextResponse.json({ error: "Workspace id is required" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { name?: string }
  const name = String(body.name ?? "").trim()
  if (name.length < 2) {
    return NextResponse.json({ error: "Enter a business name (at least 2 characters)" }, { status: 400 })
  }

  try {
    const organization = await updateOrganizationNameForOwner(workspaceId, userId, name)
    const organizations = await listOrganizationsForOwner(userId)
    return NextResponse.json({ data: { organization, organizations } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not rename workspace"
    console.error("[PATCH /api/workspaces/[id]] failed:", e)
    const status = /not found/i.test(msg) ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const userId = await requireOwner(req)
  if (userId instanceof NextResponse) return userId

  const { id } = await ctx.params
  const workspaceId = String(id ?? "").trim()
  if (!workspaceId) return NextResponse.json({ error: "Workspace id is required" }, { status: 400 })

  try {
    const result = await deleteOrganizationForOwner(workspaceId, userId)
    const organizations = await listOrganizationsForOwner(userId)
    return NextResponse.json({ data: { ...result, organizations } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete workspace"
    console.error("[DELETE /api/workspaces/[id]] failed:", e)
    const status = /not found/i.test(msg) ? 404 : /keep at least one/i.test(msg) ? 409 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
