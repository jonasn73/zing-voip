// Owner cell vs inbound business DID — the signup cell is a ring target, not a customer-facing line.

import { phoneDigits10 } from "@/lib/dashboard-routing-utils"

/** True when a stored line number is the same as the owner's personal cell. */
export function lineMatchesOwnerCell(
  lineNumber: string | null | undefined,
  ownerPhone: string | null | undefined
): boolean {
  const lineDigits = phoneDigits10(lineNumber)
  const ownerDigits = phoneDigits10(ownerPhone)
  if (!lineDigits || !ownerDigits) return false
  return lineDigits === ownerDigits
}

/**
 * Remove rows that duplicate the owner's cell from inbound line pickers.
 * Keeps the mirror only when it is the account's sole line (edge case).
 */
export function filterInboundBusinessLines<T extends { number: string }>(
  lines: T[],
  ownerPhone: string | null | undefined
): T[] {
  if (!ownerPhone?.trim()) return lines
  const filtered = lines.filter((line) => !lineMatchesOwnerCell(line.number, ownerPhone))
  return filtered.length > 0 ? filtered : lines
}
