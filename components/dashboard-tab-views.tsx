"use client"

import { memo, useDeferredValue, useEffect, useState, type ComponentType } from "react"
import type { PageId } from "@/components/app-shell"
import { cn } from "@/lib/utils"
import { ActivityWorkspaceView } from "@/components/workspace-views/activity-workspace-view"
import { LeadsWorkspaceView } from "@/components/workspace-views/leads-workspace-view"
import { TeamWorkspaceView } from "@/components/workspace-views/team-workspace-view"
import { PayWorkspaceView } from "@/components/workspace-views/pay-workspace-view"
import { SettingsWorkspaceView } from "@/components/workspace-views/settings-workspace-view"

export const WORKSPACE_TAB_IDS = ["activity", "leads", "contacts", "pay", "settings"] as const
export type WorkspaceTabId = (typeof WORKSPACE_TAB_IDS)[number]

/** Active + previous tab only — older tabs unmount to limit memory. */
const MAX_MOUNTED_TABS = 2

const TAB_VIEWS: Record<WorkspaceTabId, ComponentType> = {
  activity: ActivityWorkspaceView,
  leads: LeadsWorkspaceView,
  contacts: TeamWorkspaceView,
  pay: PayWorkspaceView,
  settings: SettingsWorkspaceView,
}

export function isWorkspaceTab(page: PageId): page is WorkspaceTabId {
  return (WORKSPACE_TAB_IDS as readonly string[]).includes(page)
}

function nextMountedTabs(prev: WorkspaceTabId[], active: WorkspaceTabId): WorkspaceTabId[] {
  const rest = prev.filter((t) => t !== active)
  return [active, ...rest].slice(0, MAX_MOUNTED_TABS)
}

export const DashboardTabHost = memo(function DashboardTabHost({
  activeTab,
}: {
  activeTab: WorkspaceTabId
}) {
  const displayTab = useDeferredValue(activeTab)
  const [mountedTabs, setMountedTabs] = useState<WorkspaceTabId[]>(() => [activeTab])

  useEffect(() => {
    setMountedTabs((current) => nextMountedTabs(current, activeTab))
  }, [activeTab])

  const isDeferred = displayTab !== activeTab

  return (
    <div className={cn("relative w-full", isDeferred && "pointer-events-none opacity-[0.98]")} aria-busy={isDeferred}>
      {WORKSPACE_TAB_IDS.map((tab) => {
        if (!mountedTabs.includes(tab)) return null
        const View = TAB_VIEWS[tab]
        const isVisible = tab === displayTab
        return (
          <section
            key={tab}
            role="tabpanel"
            aria-label={tab}
            hidden={!isVisible}
            inert={isVisible ? undefined : true}
            className={cn(
              "w-full",
              !isVisible && "hidden [content-visibility:hidden] [contain:strict]"
            )}
          >
            <View />
          </section>
        )
      })}
    </div>
  )
})

export function DashboardTabView(_props: { tab: WorkspaceTabId }) {
  return null
}
