"use client"

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { readActiveOrganizationId } from "@/lib/workspace-organizations"

const DashboardBootstrapContext = createContext<DashboardMainBootstrap | null>(null)

export function DashboardBootstrapProvider({
  bootstrap,
  children,
}: {
  bootstrap: DashboardMainBootstrap
  children: ReactNode
}) {
  return (
    <DashboardBootstrapContext.Provider value={bootstrap}>{children}</DashboardBootstrapContext.Provider>
  )
}

export function useDashboardBootstrapOptional(): DashboardMainBootstrap | null {
  return useContext(DashboardBootstrapContext)
}

/** Mirrors streamed bootstrap into workspace context before paint (for cross-tab filters). */
export function DashboardBootstrapSync() {
  const bootstrap = useDashboardBootstrapOptional()
  const {
    activeLine,
    setActiveLine,
    setActiveOrganizationId,
    setBusinessNumbers,
    setBusinessNumbersLoading,
    setOrganizations,
  } = useDashboardWorkspace()

  useLayoutEffect(() => {
    if (!bootstrap) return
    setOrganizations(bootstrap.organizations)
    setBusinessNumbers(bootstrap.phoneLines)
    setBusinessNumbersLoading(false)

    const stored = readActiveOrganizationId()
    const def = bootstrap.organizations.find((o) => o.is_default) ?? bootstrap.organizations[0]
    const pick =
      (stored && bootstrap.organizations.some((o) => o.id === stored) ? stored : null) ??
      def?.id ??
      null
    if (pick) setActiveOrganizationId(pick)

    if (bootstrap.routing.primaryLineNumber && !activeLine) {
      setActiveLine(bootstrap.routing.primaryLineNumber)
    }
  }, [
    activeLine,
    bootstrap,
    setActiveLine,
    setActiveOrganizationId,
    setBusinessNumbers,
    setBusinessNumbersLoading,
    setOrganizations,
  ])

  return null
}
