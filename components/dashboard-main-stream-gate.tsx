"use client"

import { Suspense, use, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import { DashboardBootstrapProvider } from "@/components/dashboard-bootstrap-context"
import { useDashboardStream } from "@/components/dashboard-stream-context"
import { OrganizationSwitcherPlaceholder } from "@/components/organization-switcher"
import { AppShell } from "@/components/app-shell"
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

function DashboardMainStreamLoadingShell({
  pathname,
  sessionBusinessName,
}: {
  pathname: string
  sessionBusinessName?: string
}) {
  return (
    <AppShell
      pathname={pathname}
      accountHeader={{ kind: "loading" }}
      headerCenter={
        <OrganizationSwitcherPlaceholder
          label={sessionBusinessName?.trim() || "Business"}
        />
      }
    >
      <DashboardRoutingPageSkeleton />
    </AppShell>
  )
}

/** One Suspense boundary for /dashboard — header, sidebar, and call flow appear together. */
export function DashboardMainStreamGate({
  children,
  pathname,
  sessionBusinessName,
  activePage,
}: {
  children: ReactNode
  pathname: string
  sessionBusinessName?: string
  activePage: PageId
}) {
  const { dashboardMainBootstrapPromise } = useDashboardStream()

  if (!dashboardMainBootstrapPromise || activePage !== "dashboard") {
    return <>{children}</>
  }

  return (
    <Suspense
      fallback={
        <DashboardMainStreamLoadingShell
          pathname={pathname}
          sessionBusinessName={sessionBusinessName}
        />
      }
    >
      <DashboardBootstrapFromStream promise={dashboardMainBootstrapPromise}>
        {children}
      </DashboardBootstrapFromStream>
    </Suspense>
  )
}
