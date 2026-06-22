"use client"

// Group active pipeline jobs by execution phase for the map split-view left panel.

import { useMemo } from "react"
import { Car, Clock, MapPin, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { vehicleLabelFromParts } from "@/lib/job-pool"
import {
  PIPELINE_PANEL_GROUP_ORDER,
  PIPELINE_PANEL_GROUP_TITLE,
  SCHEDULER_CARD_STYLE,
  SCHEDULER_STATUS_LABEL,
  schedulerLifecyclePhase,
  type SchedulerLifecyclePhase,
} from "@/lib/scheduler-job-status"
import type { ActivePipelineJob } from "@/lib/types"

function formatPhone(num: string | null): string {
  if (!num) return "—"
  const d = num.replace(/\D/g, "")
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return num
}

function formatTime(iso: string | null): string {
  if (!iso) return "Unscheduled"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function jobPhase(job: ActivePipelineJob): SchedulerLifecyclePhase {
  return schedulerLifecyclePhase({
    job_status: job.job_status,
    dispatch_status: job.dispatch_status,
    assigned_tech_id: job.assigned_tech_id,
  })
}

type ActivePipelinePanelProps = {
  jobs: ActivePipelineJob[]
  loading?: boolean
  highlightId?: string | null
  onFocusJob: (job: ActivePipelineJob) => void
}

export function ActivePipelinePanel({ jobs, loading, highlightId, onFocusJob }: ActivePipelinePanelProps) {
  const grouped = useMemo(() => {
    const buckets = new Map<SchedulerLifecyclePhase, ActivePipelineJob[]>()
    for (const phase of PIPELINE_PANEL_GROUP_ORDER) {
      buckets.set(phase, [])
    }
    for (const job of jobs) {
      const phase = jobPhase(job)
      if (phase === "completed") continue
      buckets.get(phase)?.push(job)
    }
    return PIPELINE_PANEL_GROUP_ORDER.map((phase) => ({
      phase,
      title: PIPELINE_PANEL_GROUP_TITLE[phase],
      jobs: buckets.get(phase) ?? [],
    })).filter((g) => g.jobs.length > 0)
  }, [jobs])

  if (loading) {
    return (
      <p className="p-6 text-center text-sm text-zinc-500">Loading active pipeline…</p>
    )
  }

  if (grouped.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-zinc-500">
        No active jobs for this day — completed stops are hidden from the dispatch board.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {grouped.map((group) => (
        <section key={group.phase} aria-label={group.title}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {group.title}
            <span className="ml-2 font-normal text-zinc-600">({group.jobs.length})</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {group.jobs.map((job) => {
              const phase = jobPhase(job)
              const vehicle = vehicleLabelFromParts(job.vehicle_year, job.vehicle_make, job.vehicle_model)
              const highlighted = highlightId === job.id
              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => onFocusJob(job)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-[box-shadow,transform] hover:brightness-110 motion-safe:active:scale-[0.99]",
                      SCHEDULER_CARD_STYLE[phase],
                      highlighted && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {job.customer_name || formatPhone(job.customer_phone)}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          SCHEDULER_CARD_STYLE[phase]
                        )}
                      >
                        {SCHEDULER_STATUS_LABEL[phase]}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs opacity-90">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      {formatTime(job.scheduled_at)}
                      {job.job_type ? ` · ${job.job_type}` : ""}
                    </p>
                    {vehicle ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
                        <Car className="h-3 w-3 shrink-0" aria-hidden />
                        {vehicle}
                      </p>
                    ) : null}
                    {job.assigned_tech_name ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
                        <User className="h-3 w-3 shrink-0" aria-hidden />
                        {job.assigned_tech_name}
                      </p>
                    ) : null}
                    {job.location ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] opacity-75">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        <span className="line-clamp-2">{job.location}</span>
                      </p>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
