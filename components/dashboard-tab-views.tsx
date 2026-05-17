"use client"

import type { ComponentType } from "react"
import type { PageId } from "@/components/app-shell"
import { ActivityWorkspaceView } from "@/components/workspace-views/activity-workspace-view"
import { LeadsWorkspaceView } from "@/components/workspace-views/leads-workspace-view"
import { TeamWorkspaceView } from "@/components/workspace-views/team-workspace-view"
import { PayWorkspaceView } from "@/components/workspace-views/pay-workspace-view"
import { SettingsWorkspaceView } from "@/components/workspace-views/settings-workspace-view"

/** Maps bottom-nav tab ids to workspace views (Routing uses `DashboardPage` on `/dashboard`). */
const TAB_VIEWS: Partial<Record<PageId, ComponentType>> = {
  activity: ActivityWorkspaceView,
  leads: LeadsWorkspaceView,
  contacts: TeamWorkspaceView,
  pay: PayWorkspaceView,
  settings: SettingsWorkspaceView,
}

export function DashboardTabView({ tab }: { tab: PageId }) {
  const View = TAB_VIEWS[tab]
  if (!View) return null
  return <View />
}
