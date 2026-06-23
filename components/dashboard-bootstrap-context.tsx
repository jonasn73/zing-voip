"use client"

import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react"
import type { DashboardMainBootstrap } from "@/lib/dashboard-stream-types"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { readActiveOrganizationId } from "@/lib/workspace-organizations"

const DashboardBootstrapContext = createContext<DashboardMainBootstrap | null>(null)

function pickActiveOrganizationId(organizations: DashboardMainBootstrap["organizations"]): string | null {
  const stored = readActiveOrganizationId()
  const def = organizations.find((o) => o.is_default) ?? organizations[0]
  return (stored && organizations.some((o) => o.id === stored) ? stored : null) ?? def?.id ?? null
}

/** Hydrates workspace from bootstrap before paint — avoids a second header/content flash. */
function DashboardBootstrapWorkspaceSync({ bootstrap }: { bootstrap: DashboardMainBootstrap }) {
  const { hydrateWorkspaceFromBootstrap } = useDashboardWorkspace()
  const syncedRef = useRef(false)

  useLayoutEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    hydrateWorkspaceFromBootstrap({
      organizations: bootstrap.organizations,
      phoneLines: bootstrap.phoneLines,
      activeOrganizationId: pickActiveOrganizationId(bootstrap.organizations),
      activeLine: bootstrap.routing.primaryLineNumber,
    })
  }, [bootstrap, hydrateWorkspaceFromBootstrap])

  return null
}

export function DashboardBootstrapProvider({
  bootstrap,
  children,
}: {
  bootstrap: DashboardMainBootstrap
  children: ReactNode
}) {
  return (
    <DashboardBootstrapContext.Provider value={bootstrap}>
      <DashboardBootstrapWorkspaceSync bootstrap={bootstrap} />
      {children}
    </DashboardBootstrapContext.Provider>
  )
}

export function useDashboardBootstrapOptional(): DashboardMainBootstrap | null {
  return useContext(DashboardBootstrapContext)
}
