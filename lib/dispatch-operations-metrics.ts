// Live dispatch counters for the scheduler operations metric strip.

import { schedulerLifecyclePhase } from "@/lib/scheduler-job-status"
import type { ActivePipelineJob, SchedulerEvent, UnassignedPoolJob } from "@/lib/types"

/** One row of live dispatch KPIs for the selected day. */
export type DispatchOperationsMetrics = {
  activeDispatches: number
  unassignedPool: number
  onSite: number
  completedToday: number
}

type JobLike = {
  id: string
  job_status?: string | null
  dispatch_status?: string | null
  assigned_tech_id?: string | null
}

function phaseFor(job: JobLike) {
  return schedulerLifecyclePhase({
    job_status: job.job_status,
    dispatch_status: job.dispatch_status,
    assigned_tech_id: job.assigned_tech_id,
  })
}

/** Merge pipeline + calendar rows without double-counting the same lead id. */
function mergedDayJobs(
  activePipelineJobs: ActivePipelineJob[],
  dayEvents: SchedulerEvent[]
): JobLike[] {
  const byId = new Map<string, JobLike>()
  for (const job of activePipelineJobs) byId.set(job.id, job)
  for (const ev of dayEvents) byId.set(ev.id, ev)
  return [...byId.values()]
}

/** Compute KPIs for the operations banner (client-safe, no I/O). */
export function computeDispatchOperationsMetrics(params: {
  poolJobs: UnassignedPoolJob[]
  activePipelineJobs: ActivePipelineJob[]
  dayEvents: SchedulerEvent[]
}): DispatchOperationsMetrics {
  const merged = mergedDayJobs(params.activePipelineJobs, params.dayEvents)

  let activeDispatches = 0
  let onSite = 0
  let completedToday = 0

  for (const job of merged) {
    const phase = phaseFor(job)
    if (phase === "scheduled" || phase === "en_route" || phase === "on_site") {
      activeDispatches += 1
    }
    if (phase === "on_site") onSite += 1
    if (phase === "completed") completedToday += 1
  }

  return {
    activeDispatches,
    unassignedPool: params.poolJobs.length,
    onSite,
    completedToday,
  }
}
