"use client"

import { Suspense, use, useCallback, useEffect } from "react"
import { OrganizationSwitcher, OrganizationSwitcherPlaceholder } from "@/components/organization-switcher"
import { useDashboardBootstrapOptional } from "@/components/dashboard-bootstrap-context"
import { useDashboardStream } from "@/components/dashboard-stream-context"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { readActiveOrganizationId } from "@/lib/workspace-organizations"
import type { Organization } from "@/lib/types"

/** Resolves streamed org rows and mounts the live workspace switcher. */
function OrganizationSwitcherFromStream({
  promise,
  onOrganizationsLoaded,
  onOrganizationChange,
}: {
  promise: Promise<Organization[]>
  onOrganizationsLoaded: (orgs: Organization[]) => void
  onOrganizationChange: (id: string | null) => void
}) {
  const organizations = use(promise)
  return (
    <OrganizationSwitcher
      seedOrganizations={organizations}
      skipInitialFetch
      onOrganizationsLoaded={onOrganizationsLoaded}
      onOrganizationChange={onOrganizationChange}
    />
  )
}

/** Business workspace switcher mounted in the dashboard app header. */
export function DashboardHeaderWorkspace({ sessionBusinessName }: { sessionBusinessName?: string }) {
  const bootstrap = useDashboardBootstrapOptional()
  const { organizationsPromise } = useDashboardStream()
  const { setActiveOrganizationId, setOrganizations } = useDashboardWorkspace()

  const handleOrganizationChange = useCallback(
    (id: string | null) => {
      setActiveOrganizationId(id)
    },
    [setActiveOrganizationId]
  )

  if (bootstrap) {
    return (
      <OrganizationSwitcher
        seedOrganizations={bootstrap.organizations}
        skipInitialFetch
        onOrganizationsLoaded={setOrganizations}
        onOrganizationChange={handleOrganizationChange}
      />
    )
  }

  if (organizationsPromise) {
    return (
      <Suspense
        fallback={
          <OrganizationSwitcherPlaceholder
            label={sessionBusinessName?.trim() || "Business"}
          />
        }
      >
        <OrganizationSwitcherFromStream
          promise={organizationsPromise}
          onOrganizationsLoaded={setOrganizations}
          onOrganizationChange={handleOrganizationChange}
        />
      </Suspense>
    )
  }

  return (
    <OrganizationSwitcher
      sessionBusinessName={sessionBusinessName}
      onOrganizationsLoaded={setOrganizations}
      onOrganizationChange={handleOrganizationChange}
    />
  )
}

/** Loads organizations into workspace context when server stream is unavailable (client tab nav). */
export function DashboardOrganizationsBootstrap() {
  const bootstrap = useDashboardBootstrapOptional()
  const { organizationsPromise, dashboardMainBootstrapPromise } = useDashboardStream()
  const { setOrganizations, setActiveOrganizationId } = useDashboardWorkspace()

  useEffect(() => {
    if (bootstrap || organizationsPromise || dashboardMainBootstrapPromise) return
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
  }, [
    bootstrap,
    dashboardMainBootstrapPromise,
    organizationsPromise,
    setOrganizations,
    setActiveOrganizationId,
  ])

  return null
}
