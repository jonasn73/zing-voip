"use client"

// Live KPI banner for the dispatch map — stays inside the main column (no viewport bleed).

import { memo, useMemo } from "react"
import { cn } from "@/lib/utils"
import { WORKSPACE_MOBILE_BLEED } from "@/components/dashboard-workspace-ui"
import { computeDispatchOperationsMetrics } from "@/lib/dispatch-operations-metrics"
import type { ActivePipelineJob, SchedulerEvent, UnassignedPoolJob } from "@/lib/types"

type MetricCellProps = {
  label: string
  value: number
  valueClassName?: string
  className?: string
}

function MetricCell({ label, value, valueClassName, className }: MetricCellProps) {
  return (
    <div className={cn("flex min-w-[9.5rem] shrink-0 snap-start flex-col gap-0.5 md:min-w-0", className)}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums text-zinc-100", valueClassName)}>{value}</span>
    </div>
  )
}

function MetricDivider() {
  return <div className="hidden h-4 w-px shrink-0 bg-zinc-800 md:block" aria-hidden />
}

export const DispatchOperationsMetricStrip = memo(function DispatchOperationsMetricStrip({
  poolJobs,
  activePipelineJobs,
  dayEvents,
  className,
}: {
  poolJobs: UnassignedPoolJob[]
  activePipelineJobs: ActivePipelineJob[]
  dayEvents: SchedulerEvent[]
  className?: string
}) {
  const metrics = useMemo(
    () =>
      computeDispatchOperationsMetrics({
        poolJobs,
        activePipelineJobs,
        dayEvents,
      }),
    [poolJobs, activePipelineJobs, dayEvents]
  )

  return (
    <div
      className={cn(WORKSPACE_MOBILE_BLEED, className)}
      aria-label="Live dispatch operations summary"
    >
      <div className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 whitespace-nowrap border-b border-zinc-800 bg-zinc-900/90 px-4 py-2 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:whitespace-normal md:px-8 md:py-3 [&::-webkit-scrollbar]:hidden">
        <MetricCell label="Active Dispatches" value={metrics.activeDispatches} valueClassName="text-sky-300" />
        <MetricDivider />
        <MetricCell label="Unassigned Pool" value={metrics.unassignedPool} valueClassName="text-amber-300" />
        <MetricDivider />
        <MetricCell label="On-Site" value={metrics.onSite} valueClassName="text-yellow-300" />
        <MetricDivider />
        <MetricCell label="Completed Today" value={metrics.completedToday} valueClassName="text-zinc-400" />
      </div>
    </div>
  )
})
