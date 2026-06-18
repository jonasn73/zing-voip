"use client"

// Owner job scheduler — calendar of BOOKED and PENDING_TIME leads.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Loader2, MapPin, Phone } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/dashboard-workspace-ui"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { cn } from "@/lib/utils"
import { dayKeyLocal } from "@/lib/scheduler-utils"
import type { SchedulerEvent } from "@/lib/types"

function formatPhone(num: string | null): string {
  if (!num) return "—"
  const d = num.replace(/\D/g, "")
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return num
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const DISPOSITION_STYLE: Record<string, string> = {
  BOOKED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PENDING_TIME: "bg-amber-500/15 text-amber-200 border-amber-500/30",
}

export function SchedulerWorkspaceView() {
  const { activeOrganizationId } = useDashboardWorkspace()
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<SchedulerEvent[]>([])
  const [loading, setLoading] = useState(true)

  const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`

  const orgQuery =
    activeOrganizationId && !activeOrganizationId.startsWith("legacy-")
      ? `&organization_id=${encodeURIComponent(activeOrganizationId)}`
      : ""

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SchedulerEvent[]>()
    for (const ev of events) {
      const key = dayKeyLocal(new Date(ev.scheduled_at))
      const list = map.get(key) ?? []
      list.push(ev)
      map.set(key, list)
    }
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

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Dispatch" title="Scheduler" />
      <p className="-mt-4 text-sm text-zinc-500">
        Booked and pending-time jobs across your workspace. Events come from receptionist dispositions and intake forms.
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
              hasJob: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
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

        <WorkspacePanel className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              {selectedDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {dayEvents.length === 0 ? "No scheduled jobs on this day." : `${dayEvents.length} job(s)`}
            </p>
          </div>

          {dayEvents.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-zinc-500">
              Jobs appear here when a receptionist marks a call as Booked or Pending time.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {dayEvents.map((ev) => (
                <li key={ev.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {ev.customer_name || formatPhone(ev.customer_phone) || "Customer"}
                      </p>
                      {ev.summary ? <p className="mt-1 text-sm text-zinc-400">{ev.summary}</p> : null}
                    </div>
                    {ev.disposition ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                          DISPOSITION_STYLE[ev.disposition] ?? "border-border/60 text-zinc-400"
                        )}
                      >
                        {ev.disposition.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {formatTime(ev.scheduled_at)}
                      {ev.scheduled_tentative ? " (estimated)" : ""}
                    </span>
                    {ev.customer_phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" aria-hidden />
                        {formatPhone(ev.customer_phone)}
                      </span>
                    ) : null}
                    {ev.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {ev.location}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
