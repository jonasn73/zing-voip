// Maps a line's industry/skill tag to the receptionist intake form variant.

export type ReceptionistBusinessType = "locksmith" | "detailing" | "generic"

/** Resolve which live intake form a receptionist should see for a given industry tag. */
export function resolveBusinessType(industryTag: string | null | undefined): ReceptionistBusinessType {
  const tag = (industryTag ?? "").toLowerCase().replace(/[-\s]+/g, "_")
  if (!tag) return "generic"
  const head = tag.split("_")[0]
  if (["locksmith", "automotive", "auto", "key", "keys"].includes(head)) return "locksmith"
  if (["detailing", "detail", "carwash", "car", "wash"].includes(head)) return "detailing"
  return "generic"
}
