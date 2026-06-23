// Shared copy + styling for scheduler map marker tooltips and icons.

import { vehicleLabelFromParts } from "@/lib/job-pool"
import {
  SCHEDULER_MAP_PIN_COLOR,
  SCHEDULER_STATUS_LABEL,
  type SchedulerLifecyclePhase,
  schedulerLifecyclePhase,
} from "@/lib/scheduler-job-status"
import type { SchedulerEvent, UnassignedPoolJob } from "@/lib/types"

export type MapMarkerTooltipModel = {
  id: string
  kind: "pool" | "scheduled"
  phase: SchedulerLifecyclePhase
  customerName: string | null
  customerPhone: string | null
  vehicleLine: string | null
  keyTypeLine: string | null
  jobType: string | null
  statusLabel: string
  pinColor: string
  routeOrder?: number
}

export function formatMapPhone(num: string | null): string {
  if (!num) return "—"
  const d = num.replace(/\D/g, "")
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return num
}

/** Pull a human key-type line from intake notes / job type. */
export function keyTypeLine(jobType: string | null, jobNotes: string | null): string | null {
  const notes = (jobNotes ?? "").toLowerCase()
  const parts: string[] = []
  if (/smart|prox/.test(notes)) parts.push("Smart / Prox")
  if (/laser/.test(notes)) parts.push("Laser cut")
  if (/akl|all keys lost/.test(notes)) parts.push("AKL")
  if (parts.length) return parts.join(" · ")
  if (jobType?.trim()) return jobType.trim()
  return null
}

export function tooltipFromPoolJob(
  job: UnassignedPoolJob,
  poolIndex: number,
  extras?: { job_status?: string | null; assigned_tech_id?: string | null }
): MapMarkerTooltipModel {
  const phase = schedulerLifecyclePhase({
    dispatch_status: job.dispatch_status,
    assigned_tech_id: extras?.assigned_tech_id ?? null,
    job_status: extras?.job_status ?? null,
  })
  return {
    id: job.id,
    kind: "pool",
    phase,
    customerName: job.customer_name,
    customerPhone: job.customer_phone,
    vehicleLine: vehicleLabelFromParts(job.vehicle_year, job.vehicle_make, job.vehicle_model),
    keyTypeLine: keyTypeLine(job.job_type, job.job_notes),
    jobType: job.job_type,
    statusLabel: SCHEDULER_STATUS_LABEL[phase],
    pinColor: SCHEDULER_MAP_PIN_COLOR[phase],
    routeOrder: poolIndex,
  }
}

export function tooltipFromScheduledEvent(
  event: SchedulerEvent,
  routeOrder: number
): MapMarkerTooltipModel {
  const phase = schedulerLifecyclePhase({
    job_status: event.job_status,
    dispatch_status: event.dispatch_status,
    assigned_tech_id: event.assigned_tech_id,
  })
  return {
    id: event.id,
    kind: "scheduled",
    phase,
    customerName: event.customer_name,
    customerPhone: event.customer_phone,
    vehicleLine: vehicleLabelFromParts(event.vehicle_year, event.vehicle_make, event.vehicle_model),
    keyTypeLine: keyTypeLine(event.job_type, event.job_notes),
    jobType: event.job_type,
    statusLabel: SCHEDULER_STATUS_LABEL[phase],
    pinColor: SCHEDULER_MAP_PIN_COLOR[phase],
    routeOrder,
  }
}

/** HTML for a numbered scheduled pin. */
export function scheduledPinHtml(order: number, color: string, phase: SchedulerLifecyclePhase): string {
  if (phase === "completed") {
    return `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(34,197,94,0.35);border:2px solid rgba(34,197,94,0.65);color:#bbf7d0;font-size:13px;font-weight:800;opacity:0.85">✓</span>`
  }
  const pulse =
    phase === "en_route"
      ? "animation:enRoutePulse 1.6s ease-out infinite;"
      : phase === "on_site"
        ? "animation:onSitePulse 1.8s ease-out infinite;"
        : ""
  return `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color};border:2px solid rgba(0,0,0,0.45);color:#ecfdf5;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.35);${pulse}">${order}</span>`
}

/** HTML for an unassigned hopper pin (pulsing orange/grey). */
export function poolPinHtml(label: string, color = "#f97316"): string {
  return `<span class="hopper-pulse" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#78716c,${color});border:2px solid ${color};color:#fff7ed;font-size:11px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.45)">${label}</span>`
}

export const MAP_MARKER_ANIMATION_CSS = `
  @keyframes hopperPulse {
    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }
    70% { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
  }
  @keyframes enRoutePulse {
    0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.65); }
    70% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
    100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
  }
  @keyframes onSitePulse {
    0% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.65); }
    70% { box-shadow: 0 0 0 10px rgba(251, 146, 60, 0); }
    100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0); }
  }
  @keyframes techEnRouteRing {
    0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.75), 0 0 12px rgba(45, 212, 191, 0.35); }
    70% { box-shadow: 0 0 0 12px rgba(45, 212, 191, 0), 0 0 16px rgba(45, 212, 191, 0.45); }
    100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0), 0 0 12px rgba(45, 212, 191, 0.35); }
  }
  @keyframes techOnSiteRing {
    0%, 100% { box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.95), 0 0 14px rgba(250, 204, 21, 0.55); }
    50% { box-shadow: 0 0 0 4px rgba(234, 179, 8, 1), 0 0 20px rgba(250, 204, 21, 0.75); }
  }
  .hopper-pulse { animation: hopperPulse 2s ease-out infinite; }
  .tech-marker-en-route { animation: techEnRouteRing 1.8s ease-out infinite; }
  .tech-marker-on-site { animation: techOnSiteRing 2.2s ease-in-out infinite; }
`

/** Micro-badge pin for a live technician — initials + status ring. */
export function techBadgePinHtml(initials: string, status: string | null): string {
  const isEnRoute = status === "en_route"
  const isOnSite = status === "on_site" || status === "arrived"
  const ringClass = isEnRoute
    ? "tech-marker-en-route"
    : isOnSite
      ? "tech-marker-on-site"
      : ""
  const fill = isEnRoute ? "#0f766e" : isOnSite ? "#ca8a04" : "#52525b"
  const textColor = isOnSite ? "#fef9c3" : "#ecfdf5"
  const border = isOnSite ? "2px solid #facc15" : "2px solid #18181b"
  const idleShadow = !isEnRoute && !isOnSite ? "box-shadow:0 0 0 2px rgba(161,161,170,0.35);" : ""
  return `<span class="${ringClass}" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${fill};border:${border};font-size:10px;font-weight:800;color:${textColor};letter-spacing:-0.02em;${idleShadow}">${initials}</span>`
}
