"use client"

import { useCallback } from "react"
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

  if (organizations.length === 0) {
    return <OrganizationSwitcherPlaceholder label={placeholderLabel} />
  }

  return (
    <OrganizationSwitcher
      seedOrganizations={organizations}
      skipInitialFetch
      onOrganizationsLoaded={setOrganizations}
      onOrganizationChange={handleOrganizationChange}
    />
  )
}

export { DashboardOrganizationsBootstrap } from "@/components/dashboard-organizations-bootstrap"
