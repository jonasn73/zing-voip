"use client"

// Live clock + upcoming jobs row for the owner dispatch scheduler.

import { memo, useMemo } from "react"
import { Clock3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { WORKSPACE_MOBILE_BLEED } from "@/components/dashboard-workspace-ui"
import { DispatchOperationsMetricStrip } from "@/components/scheduler/dispatch-operations-metric-strip"
import { formatSchedulerLiveClock, useLiveClock } from "@/lib/hooks/use-live-clock"
import {
  formatUpcomingJobTime,
  listUpcomingSchedulerJobs,
  type UpcomingSchedulerJob,
} from "@/lib/scheduler-upcoming-jobs"
import { SCHEDULER_STATUS_LABEL } from "@/lib/scheduler-job-status"
import type { ActivePipelineJob, SchedulerEvent, UnassignedPoolJob } from "@/lib/types"

function UpcomingJobChip({
  job,
  onSelectJob,
}: {
  job: UpcomingSchedulerJob
  onSelectJob?: (jobId: string) => void
}) {
  const name = job.customer_name?.trim() || "Unknown customer"
  const timeLabel = job.isActiveNow ? "Now" : formatUpcomingJobTime(job.scheduled_at)
  const status = SCHEDULER_STATUS_LABEL[job.phase]

  return (
    <button
      type="button"
      onClick={() => onSelectJob?.(job.id)}
      className={cn(
        "flex min-w-[12rem] shrink-0 snap-start flex-col gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-left transition-colors",
        "hover:border-primary/40 hover:bg-primary/10"
      )}
    >
      <span className="text-[10px] font-semibold tabular-nums text-primary">{timeLabel}</span>
      <span className="truncate text-xs font-medium text-zinc-100">{name}</span>
      <span className="truncate text-[10px] text-zinc-500">
        {[job.job_type, status, job.assigned_tech_name].filter(Boolean).join(" · ")}
      </span>
    </button>
  )
}

export const SchedulerDispatchLiveStatus = memo(function SchedulerDispatchLiveStatus({
  selectedDay,
  poolJobs,
  activePipelineJobs,
  dayEvents,
  onSelectJob,
  className,
  embedded = false,
}: {
  selectedDay: Date
  poolJobs: UnassignedPoolJob[]
  activePipelineJobs: ActivePipelineJob[]
  dayEvents: SchedulerEvent[]
  onSelectJob?: (jobId: string) => void
  className?: string
  embedded?: boolean
}) {
  const now = useLiveClock()
  const clockLabel = formatSchedulerLiveClock(now)

  const upcoming = useMemo(
    () =>
      listUpcomingSchedulerJobs({
        now,
        selectedDay,
        activePipelineJobs,
        dayEvents,
        poolJobs,
        limit: 5,
      }),
    [now, selectedDay, activePipelineJobs, dayEvents, poolJobs]
  )

  return (
    <div className={cn(!embedded && WORKSPACE_MOBILE_BLEED, className)} aria-label="Dispatch live status">
      <div
        className={cn(
          "border-b border-zinc-800 bg-zinc-900/90 backdrop-blur",
          embedded ? "rounded-t-xl" : ""
        )}
      >
        <div className="flex flex-col gap-0 md:flex-row md:items-stretch">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 px-3 py-2 md:border-b-0 md:border-r md:px-4 md:py-3">
            <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Now</span>
              <time dateTime={now.toISOString()} className="text-sm font-bold tabular-nums text-zinc-100">
                {clockLabel}
              </time>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <DispatchOperationsMetricStrip
              embedded
              poolJobs={poolJobs}
              activePipelineJobs={activePipelineJobs}
              dayEvents={dayEvents}
            />
          </div>
        </div>

        <div className="border-t border-zinc-800/80 px-3 py-2 md:px-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Coming up next
          </p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-zinc-600">No upcoming jobs for this day.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.map((job) => (
                <UpcomingJobChip key={job.id} job={job} onSelectJob={onSelectJob} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
