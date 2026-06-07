"use client"

import { useCallback, useEffect } from "react"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { readActiveOrganizationId } from "@/lib/workspace-organizations"
import type { Organization } from "@/lib/types"

/** Business workspace switcher mounted in the dashboard app header. */
export function DashboardHeaderWorkspace() {
  const { setActiveOrganizationId, setOrganizations } = useDashboardWorkspace()

  const handleOrganizationChange = useCallback(
    (id: string | null) => {
      setActiveOrganizationId(id)
    },
    [setActiveOrganizationId]
  )

  return (
    <OrganizationSwitcher
      onOrganizationsLoaded={setOrganizations}
      onOrganizationChange={handleOrganizationChange}
    />
  )
}

/** Loads organizations into workspace context (runs once under the provider). */
export function DashboardOrganizationsBootstrap() {
  const { setOrganizations, setActiveOrganizationId } = useDashboardWorkspace()

  useEffect(() => {
    fetch("/api/organizations", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { organizations?: Organization[] } }) => {
        const rows = Array.isArray(j?.data?.organizations) ? j!.data!.organizations! : []
        setOrganizations(rows)
        const stored = readActiveOrganizationId()
        const def = rows.find((o) => o.is_default) ?? rows[0]
        const pick =
          (stored && rows.some((o) => o.id === stored) ? stored : null) ?? def?.id ?? null
        if (pick) setActiveOrganizationId(pick)
      })
      .catch(() => {})
  }, [setOrganizations, setActiveOrganizationId])

  return null
}
