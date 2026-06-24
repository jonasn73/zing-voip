"use client"

// Group active pipeline jobs by execution phase for the map split-view left panel.

import { useMemo } from "react"
import { Car, Clock, MapPin, Phone, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { vehicleLabelFromParts } from "@/lib/job-pool"
import {
  PIPELINE_PANEL_GROUP_ORDER,
  PIPELINE_PANEL_GROUP_TITLE,
  SCHEDULER_BADGE_STYLE,
  SCHEDULER_LIST_CARD_SHELL,
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
              const displayName = job.customer_name?.trim() || "Unknown customer"
              const phone = formatPhone(job.customer_phone)
              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => onFocusJob(job)}
                    className={cn(
                      SCHEDULER_LIST_CARD_SHELL,
                      "motion-safe:active:scale-[0.99]",
                      highlighted && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                  >
                    <p className="truncate pr-2 text-sm font-medium text-zinc-100">{displayName}</p>

                    <div className="mt-2 space-y-1">
                      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                        <span className="truncate">{phone}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                        <span className="truncate">
                          {formatTime(job.scheduled_at)}
                          {job.job_type ? ` · ${job.job_type}` : ""}
                        </span>
                      </p>
                      {vehicle ? (
                        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Car className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                          <span className="truncate">{vehicle}</span>
                        </p>
                      ) : null}
                      {job.assigned_tech_name ? (
                        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <User className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                          <span className="truncate">{job.assigned_tech_name}</span>
                        </p>
                      ) : null}
                      {job.location ? (
                        <p className="flex items-start gap-1.5 text-xs text-zinc-500">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                          <span className="line-clamp-2">{job.location}</span>
                        </p>
                      ) : null}
                    </div>

                    <span
                      className={cn(
                        "absolute bottom-2.5 right-2.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        SCHEDULER_BADGE_STYLE[phase]
                      )}
                    >
                      {SCHEDULER_STATUS_LABEL[phase]}
                    </span>
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
