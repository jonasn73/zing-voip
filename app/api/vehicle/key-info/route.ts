// GET /api/vehicle/key-info?year=2017&make=Toyota&model=RAV4
// Returns FCC profiles grouped with key photos and compatible vehicles per FCC ID.

import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { lookupFccRemoteVariants } from "@/lib/fccid-remote-variants"
import {
  formatCompatibleVehicleSummary,
  lookupCompatibleVehiclesForFcc,
  lookupVehicleKeyProfiles,
} from "@/lib/vehicle-key-reference"

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req.headers.get("cookie"))
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const yearRaw = req.nextUrl.searchParams.get("year")?.trim() ?? ""
  const make = req.nextUrl.searchParams.get("make")?.trim() ?? ""
  const model = req.nextUrl.searchParams.get("model")?.trim() ?? ""
  const year = Number(yearRaw)

  if (!yearRaw || !make || !model || !Number.isFinite(year)) {
    return NextResponse.json({ error: "year, make, and model are required" }, { status: 400 })
  }

  try {
    const result = lookupVehicleKeyProfiles(yearRaw, make, model)
    if (!result || result.profiles.length === 0) {
      return NextResponse.json({ data: { key_info: result } })
    }

    const profile_details = await Promise.all(
      result.profiles.map(async (profile) => {
        const variants = await lookupFccRemoteVariants({
          fcc_id: profile.fcc_id,
          year,
          make,
          model,
        }).then((detail) => detail.variants)

        const compatible_vehicles = lookupCompatibleVehiclesForFcc(profile.fcc_id)
        const compatible_summary = formatCompatibleVehicleSummary(compatible_vehicles, {
          year,
          make,
          model,
        })

        return {
          profile,
          variants,
          compatible_vehicles,
          compatible_summary,
        }
      })
    )

    const anyVariantPhotos = profile_details.some((detail) =>
      detail.variants.some((variant) => Boolean(variant.image_url))
    )
    const visible_profile_details =
      anyVariantPhotos && profile_details.length > 1
        ? profile_details.filter((detail) => detail.variants.length > 0)
        : profile_details

    const hasReferencePhotos = visible_profile_details.some((detail) =>
      detail.variants.some((variant) => variant.reference_image)
    )

    return NextResponse.json({
      data: {
        key_info: {
          ...result,
          profiles: visible_profile_details.map((d) => d.profile),
          profile_details: visible_profile_details,
          photo_disclaimer: hasReferencePhotos
            ? "Some photos are reference images from the same FCC ID — always confirm the key on the vehicle."
            : "Photos and titles come from public FCC ID replacement listings. Always confirm the physical key on the vehicle before ordering.",
        },
      },
    })
  } catch (e) {
    console.error("[vehicle/key-info]", e)
    return NextResponse.json({ data: { key_info: null } })
  }
}
