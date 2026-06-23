"use client"

import { Suspense, use, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import { DashboardBootstrapProvider } from "@/components/dashboard-bootstrap-context"
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

/** Suspends only main content on /dashboard — header stays mounted to avoid layout shift. */
export function DashboardMainStreamGate({
  children,
  activePage,
}: {
  children: ReactNode
  activePage: PageId
}) {
  const { dashboardMainBootstrapPromise } = useDashboardStream()

  if (!dashboardMainBootstrapPromise || activePage !== "dashboard") {
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
