// Single hub: carrier "leg answered" webhook → owner-{userId} Pusher `call-answered`.
// Used by TeXML <Number url> / <Sip url>, Telnyx status callbacks, and Call Control bridge.

import { broadcastCallAnswered, broadcastCallAnsweredBySid } from "@/lib/call-telemetry-realtime"
import {
  ensureCallLogForInboundLeg,
  getCallLogSnapshotForTelemetry,
  recordCallStatusEvent,
} from "@/lib/db"

export type NotifyOwnerInboundCallAnsweredParams = {
  /** Telnyx CallSid / call_logs.provider_call_sid */
  providerCallSid: string
  occurredAtIso?: string
  /** Fallback when the inbound row is not written yet (fast-path race). */
  ownerUserId?: string | null
  fromNumber?: string | null
  toNumber?: string | null
  callerName?: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mark the inbound call answered in Neon and push `call-answered` on the owner dashboard channel.
 * Safe to call more than once — the client dedupes by call_log id.
 */
export async function notifyOwnerInboundCallAnswered(
  params: NotifyOwnerInboundCallAnsweredParams
): Promise<{ broadcast: boolean }> {
  const sid = params.providerCallSid.trim()
  if (!sid) return { broadcast: false }

  const occurredAt = params.occurredAtIso ?? new Date().toISOString()
  const ownerUserId = params.ownerUserId?.trim()

  if (ownerUserId) {
    try {
      await ensureCallLogForInboundLeg({
        userId: ownerUserId,
        providerCallSid: sid,
        fromNumber: params.fromNumber?.trim() || "Unknown",
        toNumber: params.toNumber?.trim() || "Unknown",
        callerName: params.callerName?.trim() || null,
      })
    } catch (e) {
      console.warn("[inbound-call-answered] ensure call log failed:", e)
    }
  }

  try {
    await recordCallStatusEvent(sid, "answered", 0, occurredAt)
  } catch (e) {
    console.warn("[inbound-call-answered] recordCallStatusEvent failed:", e)
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const snapshot = await getCallLogSnapshotForTelemetry(sid)
      if (snapshot?.call_type === "incoming" && snapshot.answered_at) {
        await broadcastCallAnswered({
          ownerUserId: snapshot.user_id,
          callSid: sid,
          callLogId: snapshot.id,
          fromNumber: snapshot.from_number,
          toNumber: snapshot.to_number,
          organizationId: snapshot.organization_id,
          answeredAt: snapshot.answered_at,
        })
        return { broadcast: true }
      }
      if (snapshot && !snapshot.answered_at) {
        await recordCallStatusEvent(sid, "answered", 0, occurredAt)
      }
    } catch (e) {
      console.warn("[inbound-call-answered] broadcast attempt failed:", e)
    }
    if (attempt < 3) await sleep(200)
  }

  try {
    await broadcastCallAnsweredBySid(sid)
    return { broadcast: true }
  } catch (e) {
    console.warn("[inbound-call-answered] final broadcast failed:", e)
    return { broadcast: false }
  }
}
