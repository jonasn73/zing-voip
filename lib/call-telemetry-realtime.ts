// Realtime owner-channel events that keep the routing HUD call metrics fresh.

import { getCallLogUserIdByProviderSid } from "@/lib/db"
import { publishOwnerEvent } from "@/lib/realtime/pusher-server"

/** Fired when an inbound call row is created (Telnyx call.initiated / first ring). */
export async function broadcastCallInitiated(params: {
  ownerUserId: string
  callSid: string
  fromNumber: string
  toNumber: string
  organizationId?: string | null
}): Promise<void> {
  await publishOwnerEvent(params.ownerUserId, "call-initiated", {
    call_sid: params.callSid,
    from_number: params.fromNumber,
    to_number: params.toNumber,
    organization_id: params.organizationId ?? null,
  })
}

/** Fired when a call reaches a terminal status (updates missed + avg talk time). */
export async function broadcastCallCompleted(params: {
  ownerUserId: string
  callSid: string
  organizationId?: string | null
}): Promise<void> {
  await publishOwnerEvent(params.ownerUserId, "call-completed", {
    call_sid: params.callSid,
    organization_id: params.organizationId ?? null,
  })
}

/** Resolve owner from SID and publish call-completed (status webhook path). */
export async function broadcastCallCompletedBySid(callSid: string): Promise<void> {
  const ownerUserId = await getCallLogUserIdByProviderSid(callSid)
  if (!ownerUserId) return
  await broadcastCallCompleted({ ownerUserId, callSid })
}
