import type { PortingOrder, PortingOrderStatus } from "@/lib/types"

export const PORTING_TIMELINE_STEPS = [
  "Submitted",
  "Carrier Review",
  "Scheduled Cutover",
  "Live on Lyncr",
] as const

/** 0–3 = current step index; -1 = rejected overlay. */
export function portingTimelineStepIndex(order: PortingOrder): number {
  if (order.status === "rejected") return -1
  if (order.status === "completed") return 3
  const ts = (order.telnyx_status ?? "").toLowerCase().replace(/_/g, "-")
  if (["port-activating", "activation-in-progress", "foc-date-confirmed", "foc-date-confirmed-pending"].includes(ts)) {
    return 2
  }
  if (["in-process", "submitted", "exception"].includes(ts) || order.status === "processing") {
    return 1
  }
  return 0
}

export function portingTimelineLabel(status: PortingOrderStatus): string {
  if (status === "completed") return "Transfer complete"
  if (status === "rejected") return "Transfer rejected — check account details or contact support"
  if (status === "processing") return "Carrier is reviewing your transfer"
  return "Request submitted — awaiting carrier review"
}
