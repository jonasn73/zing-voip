// GET /api/owner/jobs/pool — unassigned hopper jobs for the active workspace

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { listOwnerUnassignedPoolJobs, setLeadCoordinates } from "@/lib/db"
import { geocodeAddress } from "@/lib/geocode"
import {
  poolCoordKey,
  geocodeQueryForPoolJob,
  poolJobNeedsGeocode,
} from "@/lib/map-pin-spread"
import type { UnassignedPoolJob } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const organizationId = req.nextUrl.searchParams.get("organization_id")?.trim() || null
  const orgId = organizationId && !organizationId.startsWith("legacy-") ? organizationId : null

  try {
    const jobs = await listOwnerUnassignedPoolJobs({
      ownerUserId: userId,
      organizationId: orgId,
    })

    const coordCounts = new Map<string, number>()
    for (const job of jobs) {
      if (job.latitude == null || job.longitude == null) continue
      const key = poolCoordKey(job.latitude, job.longitude)
      coordCounts.set(key, (coordCounts.get(key) ?? 0) + 1)
    }

    const updated: UnassignedPoolJob[] = [...jobs]
    let geocoded = 0
    for (let i = 0; i < updated.length && geocoded < 8; i++) {
      const job = updated[i]
      const key =
        job.latitude != null && job.longitude != null
          ? poolCoordKey(job.latitude, job.longitude)
          : null
      const duplicateCoords = key != null && (coordCounts.get(key) ?? 0) > 1

      if (!poolJobNeedsGeocode(job, duplicateCoords)) continue

      const address = geocodeQueryForPoolJob(job)
      if (!address) continue

      const coords = await geocodeAddress(address)
      if (!coords) continue

      await setLeadCoordinates(job.id, coords.lat, coords.lng).catch(() => {})
      updated[i] = { ...job, latitude: coords.lat, longitude: coords.lng }

      if (key) {
        coordCounts.set(key, (coordCounts.get(key) ?? 1) - 1)
        if ((coordCounts.get(key) ?? 0) <= 0) coordCounts.delete(key)
      }
      const newKey = poolCoordKey(coords.lat, coords.lng)
      coordCounts.set(newKey, (coordCounts.get(newKey) ?? 0) + 1)
      geocoded += 1
    }

    return NextResponse.json({ data: { jobs: updated } })
  } catch (e) {
    console.error("[GET /api/owner/jobs/pool]", e)
    return NextResponse.json({ data: { jobs: [] }, degraded: true })
  }
}
