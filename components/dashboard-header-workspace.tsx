"use client"

import { useCallback } from "react"
import { cn } from "@/lib/utils"
import { OrganizationSwitcher, OrganizationSwitcherPlaceholder } from "@/components/organization-switcher"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"

/** Business workspace switcher mounted in the dashboard app header. */
export function DashboardHeaderWorkspace({ sessionBusinessName }: { sessionBusinessName?: string }) {
  const { organizations, setActiveOrganizationId, setOrganizations } = useDashboardWorkspace()

  const handleOrganizationChange = useCallback(
    (id: string | null) => {
      setActiveOrganizationId(id)
    },
    [setActiveOrganizationId]
  )

  const placeholderLabel = sessionBusinessName?.trim() || organizations[0]?.name || "Business"
  const ready = organizations.length > 0

  return (
    <div
      className={cn("transform-gpu", ready && "sigo-bloom-in")}
      key={ready ? "workspace-ready" : "workspace-loading"}
    >
      {ready ? (
        <OrganizationSwitcher
          seedOrganizations={organizations}
          skipInitialFetch
          onOrganizationsLoaded={setOrganizations}
          onOrganizationChange={handleOrganizationChange}
        />
      ) : (
        <OrganizationSwitcherPlaceholder label={placeholderLabel} />
      )}
    </div>
  )
}

export { DashboardOrganizationsBootstrap } from "@/components/dashboard-organizations-bootstrap"
