// Skill-tagged routing pool — match platform receptionists to inbound business lines.

import {
  getPhoneNumberLineById,
  isReasonablePstnDialString,
  listAvailablePlatformReceptionistsForIndustryTag,
  normalizePhoneNumberE164,
  resolveIndustryTagForLine,
  type PlatformRoutingPoolReceptionist,
} from "@/lib/db"
import type { PhoneNumber } from "@/lib/types"
import type { RoutingPoolMode } from "@/lib/routing-pool-skills"
import {
  buildRoutingPoolDialTexml,
  finalizeInboundTexmlXml,
  readInboundFastDialAnswerOnBridge,
} from "@/lib/telnyx-inbound-media-quality"

export type RoutingPoolMatchResult = {
  line: PhoneNumber
  industry_tag: string
  routing_pool_mode: RoutingPoolMode
  receptionists: PlatformRoutingPoolReceptionist[]
  /** Normalized E.164 numbers ready for Telnyx `<Number>` tags. */
  dial_targets: string[]
}

/**
 * Load the active line, resolve its industry tag, and return online receptionists whose skills match.
 */
export async function getAvailableReceptionistsForLine(lineId: string): Promise<RoutingPoolMatchResult | null> {
  const line = await getPhoneNumberLineById(lineId)
  if (!line) return null

  const industryTag = await resolveIndustryTagForLine(line)
  if (!industryTag) return null

  const receptionists = await listAvailablePlatformReceptionistsForIndustryTag(industryTag)
  const dial_targets = receptionists
    .map((r) => normalizePhoneNumberE164(r.phone))
    .filter((e164) => isReasonablePstnDialString(e164))

  if (dial_targets.length === 0) return null

  return {
    line,
    industry_tag: industryTag,
    routing_pool_mode: line.routing_pool_mode ?? "sequential",
    receptionists,
    dial_targets,
  }
}

/** Build finalized TeXML that dials the matched receptionist pool for Telnyx call control. */
export function buildRoutingPoolDialResponse(params: {
  match: RoutingPoolMatchResult
  callerId?: string
  timeout: number
  action: string
}): string {
  const xml = buildRoutingPoolDialTexml({
    ...(params.callerId && isReasonablePstnDialString(params.callerId) ? { callerId: params.callerId } : {}),
    answerOnBridge: readInboundFastDialAnswerOnBridge(),
    timeout: params.timeout,
    action: params.action,
    receptionistE164List: params.match.dial_targets,
    mode: params.match.routing_pool_mode,
  })
  return finalizeInboundTexmlXml(xml)
}
