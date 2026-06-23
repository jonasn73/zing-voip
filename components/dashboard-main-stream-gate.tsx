"use client"

import { Suspense, use, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import { DashboardBootstrapProvider } from "@/components/dashboard-bootstrap-context"
import { useDashboardStream } from "@/components/dashboard-stream-context"
import { DashboardRoutingPageSkeleton } from "@/components/dashboard-routing-page-skeleton"
import { DashboardRoutingReveal } from "@/components/dashboard-routing-reveal"
import type { PageId } from "@/components/app-shell"

function DashboardBootstrapFromStream({
  promise,
  children,
}: {
  promise: Promise<DashboardMainBootstrap>
  children: ReactNode
}) {
  const bootstrap = use(promise)
  return (
    <DashboardBootstrapProvider bootstrap={bootstrap}>
      <DashboardRoutingReveal>{children}</DashboardRoutingReveal>
    </DashboardBootstrapProvider>
  )
}

/** Suspends routing with skeleton; hydrates bootstrap in the background on other tabs. */
export function DashboardMainStreamGate({
  children,
  activePage,
}: {
  children: ReactNode
  activePage: PageId
}) {
  const { dashboardMainBootstrapPromise } = useDashboardStream()

  if (!dashboardMainBootstrapPromise) {
    return <>{children}</>
  }

  if (activePage === "dashboard") {
    return (
      <Suspense fallback={<DashboardRoutingPageSkeleton />}>
        <DashboardBootstrapFromStream promise={dashboardMainBootstrapPromise}>
          {children}
        </DashboardBootstrapFromStream>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={null}>
      <DashboardBootstrapFromStream promise={dashboardMainBootstrapPromise}>
        {children}
      </DashboardBootstrapFromStream>
    </Suspense>
  )
}
