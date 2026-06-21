"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { Activity, Phone, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { isDashboardVisibleLineStatus, type DashboardBusinessNumber } from "@/lib/dashboard-routing-utils"
import { isActivePortingOrder } from "@/lib/porting-lifecycle"
import { organizationQueryString } from "@/lib/workspace-organizations"
import type { PortingOrder } from "@/lib/types"

type TelemetryPillProps = {
  label: string
  value: string | number
  icon: typeof Phone
  tone?: "default" | "amber" | "teal"
}

function TelemetryPill({ label, value, icon: Icon, tone = "default" }: TelemetryPillProps) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5",
        "bg-neutral-950/50 backdrop-blur-sm transition-colors duration-200",
        tone === "amber" && "border-amber-500/25 text-amber-100/90",
        tone === "teal" && "border-teal-500/25 text-teal-100/90",
        tone === "default" && "border-white/8 text-foreground/90"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export const RoutingTelemetryStrip = memo(function RoutingTelemetryStrip({
  businessNumbers,
  className,
}: {
  businessNumbers: DashboardBusinessNumber[]
  className?: string
}) {
  const { activeOrganizationId } = useDashboardWorkspace()
  const [pendingPorts, setPendingPorts] = useState(0)
  const [queueVolume, setQueueVolume] = useState(0)

  const activeLines = businessNumbers.filter(
    (line) => isDashboardVisibleLineStatus(line.status) && line.status === "active"
  ).length

  const refreshMetrics = useCallback(async () => {
    const orgQs = organizationQueryString(activeOrganizationId)
    try {
      const [portsRes, poolRes] = await Promise.all([
        fetch(`/api/porting/orders${orgQs}${orgQs ? "&" : "?"}active=1`, { credentials: "include" }),
        fetch(`/api/owner/jobs/pool${orgQs}`, { credentials: "include" }),
      ])
      const portsJson = portsRes.ok
        ? ((await portsRes.json()) as { data?: { orders?: PortingOrder[] } })
        : null
      const poolJson = poolRes.ok
        ? ((await poolRes.json()) as { data?: { jobs?: unknown[] } })
        : null
      const orders = Array.isArray(portsJson?.data?.orders) ? portsJson.data.orders : []
      setPendingPorts(orders.filter(isActivePortingOrder).length)
      setQueueVolume(Array.isArray(poolJson?.data?.jobs) ? poolJson.data.jobs.length : 0)
    } catch {
      setPendingPorts(0)
      setQueueVolume(0)
    }
  }, [activeOrganizationId])

  useEffect(() => {
    void refreshMetrics()
  }, [refreshMetrics])

  useEffect(() => {
    const onChanged = () => void refreshMetrics()
    window.addEventListener("zing-porting-orders-changed", onChanged)
    window.addEventListener("lyncr-workspace-data-changed", onChanged)
    return () => {
      window.removeEventListener("zing-porting-orders-changed", onChanged)
      window.removeEventListener("lyncr-workspace-data-changed", onChanged)
    }
  }, [refreshMetrics])

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-neutral-950/40 px-3 py-2.5 backdrop-blur-md",
        className
      )}
      aria-label="Workspace telemetry"
    >
      <TelemetryPill label="Active lines" value={activeLines} icon={Phone} tone="teal" />
      <TelemetryPill
        label="Pending ports"
        value={pendingPorts}
        icon={Truck}
        tone={pendingPorts > 0 ? "amber" : "default"}
      />
      <TelemetryPill label="Queue volume" value={queueVolume} icon={Activity} />
    </section>
  )
})
