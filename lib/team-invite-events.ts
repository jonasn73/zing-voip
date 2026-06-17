// Global event so routing drawers + Team tab share one invite modal host.

export { OPEN_TEAM_INVITE_MODAL_EVENT } from "@/lib/settings-modals-events"

import { OPEN_TEAM_INVITE_MODAL_EVENT } from "@/lib/settings-modals-events"

export function openTeamInviteModal() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OPEN_TEAM_INVITE_MODAL_EVENT))
}
