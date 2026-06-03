// ============================================
// Address → coordinates (geocoding)
// ============================================
// Turns a free-text service address into { lat, lng } so the field-tech 50m geofence can detect
// "arrived on site". Pluggable provider:
//   - If GOOGLE_GEOCODING_API_KEY / GOOGLE_MAPS_API_KEY is set → Google Geocoding API (most accurate).
//   - Otherwise → OpenStreetMap Nominatim (free, no key; fine for low call volume).
// Always returns null on any failure so callers can no-op safely.

export interface GeoPoint {
  lat: number
  lng: number
}

/** Pull the most address-like value out of an operator's captured job fields. */
export function pickAddressFromFields(fields: Record<string, unknown>): string | null {
  const keys = ["service_address", "address", "job_address", "location", "address_line1", "street_address"]
  for (const k of keys) {
    const v = fields[k]
    if (typeof v === "string" && v.trim().length >= 5) return v.trim()
  }
  return null
}

function googleKey(): string | null {
  return (
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  )
}

async function geocodeWithGoogle(address: string, key: string): Promise<GeoPoint | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const data = (await res.json()) as {
    status?: string
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
  }
  const loc = data.results?.[0]?.geometry?.location
  if (data.status !== "OK" || !loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null
  return { lat: loc.lat, lng: loc.lng }
}

async function geocodeWithNominatim(address: string): Promise<GeoPoint | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
  const res = await fetch(url, {
    cache: "no-store",
    // Nominatim's usage policy requires an identifying User-Agent.
    headers: { "User-Agent": "lyncr/1.0 (dispatch geofence; support@getzingapp.com)" },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
  const hit = data?.[0]
  if (!hit?.lat || !hit?.lon) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Geocode a free-text address to coordinates, or null if it can't be resolved. */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const trimmed = address?.trim()
  if (!trimmed || trimmed.length < 5) return null
  try {
    const key = googleKey()
    const point = key ? await geocodeWithGoogle(trimmed, key) : await geocodeWithNominatim(trimmed)
    if (!point) return null
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null
    return point
  } catch (e) {
    console.error("[geocode] failed for address:", e)
    return null
  }
}
