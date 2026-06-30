// Shared key style labels for intake photo cards (client + server safe).

export type KeyStyleBucket = "smart" | "remote_head" | "flip" | "keyless_fob" | "turn_key" | "other"

/** Group a listing into a physical key style bucket for picking + labels. */
export function classifyKeyStyleBucket(title: string, keyType: string | null): KeyStyleBucket {
  const blob = `${keyType ?? ""} ${title}`.toLowerCase()
  if (/diy kit|voice fob|programmer|\bobd\b|\btool\b/.test(blob)) return "other"
  if (/flip\s*key|remote flip/.test(blob)) return "flip"
  if (/remote head|key combo|combo key|remote\/key combo/.test(blob)) return "remote_head"
  if (/smart|proximity|push\s*start|keyless go/.test(blob)) return "smart"
  if (/keyless entry remote|keyless remote|remote key fob|remote fob/.test(blob) && !/combo|head|blade/.test(blob)) {
    return "keyless_fob"
  }
  if (/blade|turn key|mechanical key/.test(blob)) return "turn_key"
  if (keyType?.toLowerCase().includes("smart")) return "smart"
  return "other"
}

/** Short card label shown under each key photo. */
export function variantDisplayLabel(title: string, keyType: string | null): string {
  switch (classifyKeyStyleBucket(title, keyType)) {
    case "smart":
      return "Smart key"
    case "remote_head":
      return "Remote head key"
    case "flip":
      return "Flip key"
    case "keyless_fob":
      return "Keyless fob"
    case "turn_key":
      return "Turn key"
    default:
      if (/remote|fob/.test(title.toLowerCase())) return "Remote key"
      return "Key"
  }
}

/** Map a variant bucket to the intake form key-style dropdown value. */
export function bucketToKeyStyleOption(bucket: KeyStyleBucket): string | null {
  switch (bucket) {
    case "smart":
      return "Push start (smart key)"
    case "remote_head":
      return "Remote head key"
    case "flip":
      return "Flip key"
    case "keyless_fob":
      return "Keyless remote only"
    case "turn_key":
      return "Turn key (blade)"
    default:
      return null
  }
}

export function resolveVariantKeyStyle(
  title: string,
  keyType: string | null,
  suggested: string | null,
  currentStyle: string,
  keyStyleOptions: readonly string[]
): string {
  if (suggested && keyStyleOptions.includes(suggested)) return suggested
  const fromBucket = bucketToKeyStyleOption(classifyKeyStyleBucket(title, keyType))
  if (fromBucket && keyStyleOptions.includes(fromBucket)) return fromBucket
  if (currentStyle && currentStyle !== "Not sure yet") return currentStyle
  return "Not sure yet"
}
