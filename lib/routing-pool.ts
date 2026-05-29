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
import { resolveBusinessType } from "@/lib/business-type"
import { buildReceptionistAnswerUrl } from "@/lib/receptionist-answer-url"

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
  /** When provided, each `<Number>` gets a per-receptionist answer `url` for the realtime HUD. */
  answer?: {
    appUrl: string
    callSid: string
    callerNumber?: string | null
    callerName?: string | null
    businessName?: string | null
  }
}): string {
  let answerUrlByE164: Record<string, string> | undefined
  if (params.answer) {
    const businessType = resolveBusinessType(params.match.industry_tag)
    answerUrlByE164 = {}
    for (const r of params.match.receptionists) {
      const e164 = normalizePhoneNumberE164(r.phone)
      if (!isReasonablePstnDialString(e164)) continue
      answerUrlByE164[e164] = buildReceptionistAnswerUrl({
        appUrl: params.answer.appUrl,
        receptionistId: r.id,
        callSid: params.answer.callSid,
        businessType,
        callerNumber: params.answer.callerNumber,
        callerName: params.answer.callerName,
        businessName: params.answer.businessName ?? params.match.line.label ?? null,
      })
    }
  }
  const xml = buildRoutingPoolDialTexml({
    ...(params.callerId && isReasonablePstnDialString(params.callerId) ? { callerId: params.callerId } : {}),
    answerOnBridge: readInboundFastDialAnswerOnBridge(),
    timeout: params.timeout,
    action: params.action,
    receptionistE164List: params.match.dial_targets,
    mode: params.match.routing_pool_mode,
    ...(answerUrlByE164 ? { answerUrlByE164 } : {}),
  })
  return finalizeInboundTexmlXml(xml)
}
