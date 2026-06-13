// Carrier Lookup Guide copy for the porting interaction drawer.

import { isWirelessPortingContext } from "@/lib/porting-carrier-exceptions"
import type { PortingConversationItem, PortingOrder } from "@/lib/types"

export type CarrierLookupGuide = {
  title: string
  carrier_label: string
  tips: string[]
}

/** Build helper-card content from the porting order + recent thread snippets. */
export function buildCarrierLookupGuide(
  order: PortingOrder,
  conversation: PortingConversationItem[] = []
): CarrierLookupGuide {
  const carrierLabel = order.current_carrier?.trim() || "your current carrier"
  const snippets = conversation
    .slice(-6)
    .map((item) => item.body)
    .filter(Boolean)
  const wireless = isWirelessPortingContext({
    current_carrier: order.current_carrier,
    carrier_rejection_reason: order.carrier_rejection_reason,
    conversation_snippets: snippets,
  })
  const tips: string[] = [
    `We are transferring your line away from ${carrierLabel}. Use the exact account details they have on file.`,
  ]
  if (wireless) {
    tips.push(
      "💡 Tip: For mobile ports, your Account PIN is typically a unique 4-to-6 digit Transfer PIN generated inside your current carrier's mobile app or security settings, NOT your account password."
    )
  } else {
    tips.push(
      "💡 Tip: For landline or VoIP ports, check your latest bill or online account portal for the account number and any carrier transfer PIN."
    )
  }
  tips.push(
    "If you are unsure, call your current carrier and ask for your Number Transfer PIN (also called a port-out PIN)."
  )
  return {
    title: "Carrier Lookup Guide",
    carrier_label: carrierLabel,
    tips,
  }
}
