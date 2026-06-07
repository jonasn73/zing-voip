"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Building2, ChevronDown, Loader2, Plus } from "lucide-react"
import type { Organization } from "@/lib/types"
import {
  readActiveOrganizationId,
  writeActiveOrganizationId,
} from "@/lib/workspace-organizations"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { showUpgradeSubscriptionModal } from "@/components/upgrade-subscription-modal"
import {
  MULTI_TENANT_UPGRADE_MESSAGE,
  MULTI_TENANT_UPGRADE_TITLE,
} from "@/lib/service-context"
import type { SubscriptionTier } from "@/lib/subscription-tier"

type Props = {
  className?: string
  onOrganizationChange?: (organizationId: string | null) => void
  onOrganizationsLoaded?: (organizations: Organization[]) => void
}

type ServiceContextPayload = {
  master_test_bypass?: boolean
  subscription_tier?: SubscriptionTier
  subscription_active?: boolean
  capabilities?: { multi_tenant_workspaces?: boolean }
}

export function OrganizationSwitcher({ className, onOrganizationChange, onOrganizationsLoaded }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [canAddWorkspace, setCanAddWorkspace] = useState(false)
  const [serviceTier, setServiceTier] = useState<SubscriptionTier>("starter")
  const [subscriptionActive, setSubscriptionActive] = useState(false)

  const onOrganizationChangeRef = useRef(onOrganizationChange)
  const onOrganizationsLoadedRef = useRef(onOrganizationsLoaded)
  onOrganizationChangeRef.current = onOrganizationChange
  onOrganizationsLoadedRef.current = onOrganizationsLoaded

  const loadServiceContext = useCallback(() => {
    fetch("/api/service-context", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: ServiceContextPayload }) => {
        const data = j?.data
        if (!data) return
        setCanAddWorkspace(data.capabilities?.multi_tenant_workspaces === true)
        if (data.subscription_tier) setServiceTier(data.subscription_tier)
        setSubscriptionActive(data.subscription_active === true)
      })
      .catch(() => {})
  }, [])

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    fetch("/api/organizations", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((j: { data?: { organizations?: Organization[] } }) => {
        const rows = Array.isArray(j.data?.organizations) ? j.data!.organizations! : []
        setOrganizations(rows)
        onOrganizationsLoadedRef.current?.(rows)
        const stored = readActiveOrganizationId()
        const pick =
          (stored && rows.some((o) => o.id === stored) ? stored : null) ??
          rows.find((o) => o.is_default)?.id ??
          rows[0]?.id ??
          null
        setActiveId((prev) => {
          if (pick !== prev) {
            onOrganizationChangeRef.current?.(pick)
            return pick
          }
          return prev
        })
        if (pick) writeActiveOrganizationId(pick)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    loadServiceContext()
    const onChanged = () => {
      const id = readActiveOrganizationId()
      setActiveId(id)
      onOrganizationChangeRef.current?.(id)
    }
    window.addEventListener("lyncr-organization-changed", onChanged)
    return () => window.removeEventListener("lyncr-organization-changed", onChanged)
  }, [load, loadServiceContext])

  const active = organizations.find((o) => o.id === activeId) ?? organizations[0]

  function selectOrg(id: string) {
    if (id === activeId) return
    setActiveId(id)
    writeActiveOrganizationId(id)
    onOrganizationChangeRef.current?.(id)
  }

  function promptAddWorkspace() {
    if (!canAddWorkspace) {
      showUpgradeSubscriptionModal({
        title: MULTI_TENANT_UPGRADE_TITLE,
        message: MULTI_TENANT_UPGRADE_MESSAGE,
        currentTier: serviceTier,
        suggestedTier: "business",
        subscriptionActive,
      })
      return
    }
    const name = window.prompt("New business name", "Key Squad 502")?.trim()
    if (!name || name.length < 2) return
    void submitNewWorkspace(name)
  }

  async function submitNewWorkspace(name: string) {
    setCreating(true)
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 403 && j.upgrade_required) {
        showUpgradeSubscriptionModal({
          title: MULTI_TENANT_UPGRADE_TITLE,
          message: j.error || MULTI_TENANT_UPGRADE_MESSAGE,
          currentTier: serviceTier,
          suggestedTier: "business",
          subscriptionActive,
        })
        return
      }
      if (!res.ok) throw new Error(j.error || "Could not create business")
      const created = j.data?.organization as Organization | undefined
      if (created?.id) selectOrg(created.id)
      load({ silent: true })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not create business")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span className="hidden sm:inline">Loading…</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 max-w-[min(100%,14rem)] gap-1.5 border-border/70 bg-card/80 px-2.5 text-xs font-medium sm:max-w-[16rem] sm:px-3",
            className
          )}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{active?.name ?? "Business"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch business</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className={cn("cursor-pointer", org.id === activeId && "bg-primary/10 text-primary")}
            onSelect={() => selectOrg(org.id)}
          >
            <span className="truncate">{org.name}</span>
            {org.is_default ? (
              <span className="ml-auto text-[10px] text-muted-foreground">Default</span>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-primary"
          disabled={creating}
          onSelect={(e) => {
            e.preventDefault()
            promptAddWorkspace()
          }}
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add new business location / workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
