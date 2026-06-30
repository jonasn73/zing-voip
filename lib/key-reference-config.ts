// Key reference feature flags (safe to import from API routes and scripts).

/** When true, never fetch fccid.io at runtime — bundled CSV + JSON cache only. */
export function isKeyReferenceCacheOnly(): boolean {
  const raw = process.env.KEY_REFERENCE_CACHE_ONLY?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}
