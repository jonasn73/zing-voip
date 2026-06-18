"use client"

// Owner job scheduler — month calendar + hourly day grid with manual booking.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Loader2, MapPin, Phone, Plus, User } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { SchedulerBookingDialog } from "@/components/scheduler-booking-dialog"
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/dashboard-workspace-ui"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { cn } from "@/lib/utils"
import {
  SCHEDULER_GRID_END_HOUR,
  SCHEDULER_GRID_START_HOUR,
  SCHEDULER_HOUR_ROW_PX,
  dateAtLocalHour,
  dayKeyLocal,
  formatHourLabel,
  schedulerEventPlacement,
  schedulerHourSlots,
  toDatetimeLocalValue,
} from "@/lib/scheduler-utils"
import type { FieldTechnician, SchedulerEvent } from "@/lib/types"

function formatPhone(num: string | null): string {
  if (!num) return "—"
  const d = num.replace(/\D/g, "")
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return num
}

function formatBlockTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const DISPOSITION_STYLE: Record<string, string> = {
  BOOKED: "border-emerald-500/50 bg-emerald-500/15 text-emerald-100",
  PENDING_TIME: "border-amber-500/50 bg-amber-500/15 text-amber-100",
}

function sortEventsByTime(a: SchedulerEvent, b: SchedulerEvent): number {
  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
}

function AppointmentBlock({ ev }: { ev: SchedulerEvent }) {
  const { topPx, heightPx } = schedulerEventPlacement(
    ev.scheduled_at,
    ev.duration_minutes,
    ev.scheduled_tentative
  )
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-2 right-2 z-10 overflow-hidden rounded-lg border px-2 py-1.5 shadow-md",
        DISPOSITION_STYLE[ev.disposition ?? ""] ?? "border-primary/40 bg-primary/15 text-foreground"
      )}
      style={{ top: topPx, height: heightPx, minHeight: 36 }}
    >
      <p className="truncate text-xs font-semibold">
        {ev.customer_name || formatPhone(ev.customer_phone) || "Customer"}
      </p>
      <p className="truncate text-[10px] opacity-90">
        {ev.job_type || ev.summary || "Appointment"}
        {ev.assigned_tech_name ? ` · ${ev.assigned_tech_name}` : ""}
      </p>
      <p className="text-[10px] opacity-75">
        {formatBlockTime(ev.scheduled_at)}
        {ev.duration_minutes ? ` · ${ev.duration_minutes}m` : ""}
      </p>
    </div>
  )
}

export function SchedulerWorkspaceView() {
  const { activeOrganizationId } = useDashboardWorkspace()
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<SchedulerEvent[]>([])
  const [technicians, setTechnicians] = useState<FieldTechnician[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingStart, setBookingStart] = useState(() => toDatetimeLocalValue(new Date()))

  const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`
  const orgId =
    activeOrganizationId && !activeOrganizationId.startsWith("legacy-") ? activeOrganizationId : null
  const orgQuery = orgId ? `&organization_id=${encodeURIComponent(orgId)}` : ""

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/owner/scheduler?month=${encodeURIComponent(monthKey)}${orgQuery}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((j: { data?: { events?: SchedulerEvent[] } }) => {
        setEvents(Array.isArray(j.data?.events) ? j.data!.events! : [])
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [monthKey, orgQuery])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/technicians", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("techs"))))
      .then((j: { data?: FieldTechnician[] }) => {
        setTechnicians(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => setTechnicians([]))
  }, [])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SchedulerEvent[]>()
    for (const ev of events) {
      const key = dayKeyLocal(new Date(ev.scheduled_at))
      const list = map.get(key) ?? []
      list.push(ev)
      map.set(key, list)
    }
    for (const [, list] of map) list.sort(sortEventsByTime)
    return map
  }, [events])

  const daysWithEvents = useMemo(() => {
    const set = new Set<Date>()
    for (const key of eventsByDay.keys()) {
      const [y, m, d] = key.split("-").map(Number)
      set.add(new Date(y, m - 1, d))
    }
    return set
  }, [eventsByDay])

  const selectedKey = dayKeyLocal(selectedDay)
  const dayEvents = eventsByDay.get(selectedKey) ?? []
  const hourSlots = schedulerHourSlots()
  const gridHeightPx = hourSlots.length * SCHEDULER_HOUR_ROW_PX

  function openBookingAtHour(hour24: number) {
    setBookingStart(toDatetimeLocalValue(dateAtLocalHour(selectedDay, hour24)))
    setBookingOpen(true)
  }

  function openBookingDefault() {
    const defaultHour = Math.max(SCHEDULER_GRID_START_HOUR, Math.min(new Date().getHours(), SCHEDULER_GRID_END_HOUR))
    openBookingAtHour(defaultHour)
  }

  function handleAppointmentCreated(event: SchedulerEvent) {
    setEvents((prev) => {
      const next = [...prev.filter((e) => e.id !== event.id), event]
      next.sort(sortEventsByTime)
      return next
    })
    const eventDay = dayKeyLocal(new Date(event.scheduled_at))
    if (eventDay !== selectedKey) {
      const d = new Date(event.scheduled_at)
      setSelectedDay(d)
      setVisibleMonth(d)
    }
  }

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Dispatch"
        title="Scheduler"
        action={
          <Button type="button" size="sm" className="gap-1.5" onClick={openBookingDefault}>
            <Plus className="h-4 w-4" aria-hidden />
            Create appointment
          </Button>
        }
      />
      <p className="-mt-4 text-sm text-zinc-500">
        Click an empty hour block or use Create appointment to book manually. Receptionist dispositions appear here too.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <WorkspacePanel className="p-3">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={(d) => d && setSelectedDay(d)}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            modifiers={{ hasJob: [...daysWithEvents] }}
            modifiersClassNames={{
              hasJob:
                "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
            className="mx-auto"
          />
          {loading ? (
            <p className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Loading…
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-zinc-500">
              {events.length} job{events.length === 1 ? "" : "s"} this month
            </p>
          )}
        </WorkspacePanel>

        <WorkspacePanel className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {selectedDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {formatHourLabel(SCHEDULER_GRID_START_HOUR)} – {formatHourLabel(SCHEDULER_GRID_END_HOUR)} ·{" "}
                {dayEvents.length} appointment{dayEvents.length === 1 ? "" : "s"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={openBookingDefault}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create
            </Button>
          </div>

          <div className="max-h-[min(720px,70vh)] flex-1 overflow-y-auto">
            <div className="flex min-h-0">
              <div className="w-16 shrink-0 border-r border-border/40 bg-muted/20">
                {hourSlots.map((hour) => (
                  <div
                    key={hour}
                    className="flex items-start justify-end border-b border-border/30 pr-2 pt-1 text-[10px] font-medium text-zinc-500"
                    style={{ height: SCHEDULER_HOUR_ROW_PX }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>

              <div className="relative min-w-0 flex-1" style={{ height: gridHeightPx }}>
                {hourSlots.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-label={`Book appointment at ${formatHourLabel(hour)}`}
                    className="absolute left-0 right-0 border-b border-border/30 bg-transparent transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{
                      top: (hour - SCHEDULER_GRID_START_HOUR) * SCHEDULER_HOUR_ROW_PX,
                      height: SCHEDULER_HOUR_ROW_PX,
                    }}
                    onClick={() => openBookingAtHour(hour)}
                  />
                ))}

                {dayEvents.map((ev) => (
                  <AppointmentBlock key={ev.id} ev={ev} />
                ))}

                {dayEvents.length === 0 && !loading ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    <p className="max-w-xs text-center text-sm text-zinc-500">
                      No appointments yet — click any hour row to book, or use Create appointment above.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {dayEvents.length > 0 ? (
            <div className="border-t border-border/60 px-5 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Day summary</p>
              <ul className="flex flex-wrap gap-2">
                {dayEvents.map((ev) => (
                  <li
                    key={`sum-${ev.id}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2 py-1 text-xs text-zinc-400"
                  >
                    <Clock className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{formatBlockTime(ev.scheduled_at)}</span>
                    <span className="truncate font-medium text-zinc-300">
                      {ev.customer_name || formatPhone(ev.customer_phone)}
                    </span>
                    {ev.customer_phone ? (
                      <span className="inline-flex items-center gap-0.5 truncate">
                        <Phone className="h-3 w-3" aria-hidden />
                        {formatPhone(ev.customer_phone)}
                      </span>
                    ) : null}
                    {ev.assigned_tech_name ? (
                      <span className="inline-flex items-center gap-0.5 truncate">
                        <User className="h-3 w-3" aria-hidden />
                        {ev.assigned_tech_name}
                      </span>
                    ) : null}
                    {ev.location ? (
                      <span className="inline-flex items-center gap-0.5 truncate">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {ev.location}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </WorkspacePanel>
      </div>

      <SchedulerBookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        initialStart={bookingStart}
        organizationId={orgId}
        technicians={technicians}
        onCreated={handleAppointmentCreated}
      />
    </WorkspacePage>
  )
}
