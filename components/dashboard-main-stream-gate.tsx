"use client"

import { Suspense, use, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import {
  DashboardBootstrapProvider,
  useDashboardBootstrapOptional,
} from "@/components/dashboard-bootstrap-context"
import { useDashboardStream } from "@/components/dashboard-stream-context"
import { DashboardRoutingPageSkeleton } from "@/components/dashboard-routing-page-skeleton"
import type { PageId } from "@/components/app-shell"

function DashboardBootstrapFromStream({
  promise,
  children,
}: {
  promise: Promise<DashboardMainBootstrap>
  children: ReactNode
}) {
  const bootstrap = use(promise)
  return <DashboardBootstrapProvider bootstrap={bootstrap}>{children}</DashboardBootstrapProvider>
}

/**
 * Hydrates bootstrap on non-routing tabs in the background.
 * Routing refresh uses DashboardRoutingBootstrapGate inside the pane instead.
 */
export function DashboardMainStreamGate({
  children,
  activePage,
}: {
  children: ReactNode
  activePage: PageId
}) {
  const { dashboardMainBootstrapPromise } = useDashboardStream()

  if (!dashboardMainBootstrapPromise || activePage === "dashboard") {
    return <>{children}</>
  }

  return (
    <Suspense fallback={null}>
      <DashboardBootstrapFromStream promise={dashboardMainBootstrapPromise}>
        {children}
      </DashboardBootstrapFromStream>
    </Suspense>
  )
}

/** Keeps page padding stable — skeleton swaps to content inside the routing pane only. */
export function DashboardRoutingBootstrapGate({ children }: { children: ReactNode }) {
  const bootstrap = useDashboardBootstrapOptional()
  const { dashboardMainBootstrapPromise } = useDashboardStream()

  if (bootstrap) {
    return <>{children}</>
  }

  if (!dashboardMainBootstrapPromise) {
    return <>{children}</>
  }

  return (
    <Suspense fallback={<DashboardRoutingPageSkeleton />}>
      <DashboardBootstrapFromStream promise={dashboardMainBootstrapPromise}>
        {children}
      </DashboardBootstrapFromStream>
    </Suspense>
  )
}
