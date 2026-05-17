"use client"

import { memo, type ReactNode } from "react"
import type { PageId } from "@/components/app-shell"
import { DashboardPageView } from "@/components/dashboard-page-view"
import { DashboardTabHost, isWorkspaceTab } from "@/components/dashboard-tab-views"

/**
 * Isolated main column — re-renders when route changes, not when shell chrome state changes.
 */
export const DashboardMainContent = memo(function DashboardMainContent({
  activePage,
  routedChildren,
}: {
  activePage: PageId
  routedChildren: ReactNode
}) {
  if (isWorkspaceTab(activePage)) {
    return (
      <DashboardPageView>
        <DashboardTabHost activeTab={activePage} />
      </DashboardPageView>
    )
  }

  return <DashboardPageView animateEnter>{routedChildren}</DashboardPageView>
})
