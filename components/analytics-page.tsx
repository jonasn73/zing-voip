"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import {
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Phone,
  Pencil,
  Check,
  X,
  Settings2,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { fetcher } from "@/lib/fetcher"

interface DailyBreakdown {
  day: string
  shortDay: string
  minutes: number
  calls: number
}

interface AgentWeekData {
  id: string
  name: string
  initials: string
  color: string
  rate: number
  weeklyMinutes: number
  weeklyCalls: number
  daily: DailyBreakdown[]
  previousWeekMinutes: number
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const AGENT_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-4"]

function getWeekRange(offset: number): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getWeekLabel(offset: number): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  if (offset === 0) return `This Week (${fmt(start)} - ${fmt(end)})`
  if (offset === -1) return `Last Week (${fmt(start)} - ${fmt(end)})`
  return `${fmt(start)} - ${fmt(end)}`
}

function buildDailyForWeek(periodStart: string, dailyFromApi: { date: string; minutes: number }[]): DailyBreakdown[] {
  const start = new Date(periodStart)
  const byDate: Record<string, number> = {}
  for (const d of dailyFromApi) byDate[d.date] = d.minutes
  return SHORT_DAYS.map((shortDay, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    return {
      day: DAY_NAMES[i],
      shortDay,
      minutes: byDate[dateStr] ?? 0,
      calls: 0,
    }
  })
}

function mapApiToAgentWeekData(
  apiAgents: {
    id: string
    name: string
    total_minutes: number
    total_calls: number
    rate_per_minute: number
    total_earnings: number
    daily: { date: string; minutes: number }[]
  }[],
  periodStart: string,
  previousWeekMinutesById: Record<string, number>,
  rateOverrides: Record<string, number>
): AgentWeekData[] {
  return apiAgents.map((a, i) => ({
    id: a.id,
    name: a.name,
    initials: a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?",
    color: AGENT_COLORS[i % AGENT_COLORS.length],
    rate: rateOverrides[a.id] ?? a.rate_per_minute,
    weeklyMinutes: a.total_minutes,
    weeklyCalls: a.total_calls,
    daily: buildDailyForWeek(periodStart, a.daily),
    previousWeekMinutes: previousWeekMinutesById[a.id] ?? 0,
  }))
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function AnalyticsPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editRateValue, setEditRateValue] = useState("")
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({})
  const [showRateConfig, setShowRateConfig] = useState(false)

  const range = useMemo(() => getWeekRange(weekOffset), [weekOffset])
  const prevRange = useMemo(() => getWeekRange(weekOffset - 1), [weekOffset])
  const { data: weekData, isLoading } = useSWR<{
    agents: { id: string; name: string; total_minutes: number; total_calls: number; rate_per_minute: number; total_earnings: number; daily: { date: string; minutes: number }[] }[]
    period: { start: string; end: string }
  }>(`/api/analytics?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`, fetcher)
  const { data: prevWeekData } = useSWR<{
    agents: { id: string; total_minutes: number }[]
  }>(`/api/analytics?start=${encodeURIComponent(prevRange.start)}&end=${encodeURIComponent(prevRange.end)}`, fetcher)

  const previousWeekMinutesById = useMemo(() => {
    if (!prevWeekData?.agents) return {}
    const map: Record<string, number> = {}
    for (const a of prevWeekData.agents) map[a.id] = a.total_minutes
    return map
  }, [prevWeekData])

  const agents = useMemo(() => {
    if (!weekData?.agents?.length) return []
    return mapApiToAgentWeekData(
      weekData.agents,
      weekData.period?.start ?? range.start,
      previousWeekMinutesById,
      rateOverrides
    )
  }, [weekData, range.start, previousWeekMinutesById, rateOverrides])

  const totalMinutes = agents.reduce((sum, a) => sum + a.weeklyMinutes, 0)
  const totalCalls = agents.reduce((sum, a) => sum + a.weeklyCalls, 0)
  const totalPayout = agents.reduce(
    (sum, a) => sum + a.weeklyMinutes * a.rate,
    0
  )
  const prevTotalMinutes = agents.reduce(
    (sum, a) => sum + a.previousWeekMinutes,
    0
  )
  const minutesTrend = prevTotalMinutes
    ? ((totalMinutes - prevTotalMinutes) / prevTotalMinutes) * 100
    : 0

  function startEditRate(agent: AgentWeekData) {
    setEditingRateId(agent.id)
    setEditRateValue((rateOverrides[agent.id] ?? agent.rate).toFixed(2))
  }

  function saveRate(agentId: string) {
    const val = parseFloat(editRateValue)
    if (!isNaN(val) && val >= 0) {
      setRateOverrides((prev) => ({ ...prev, [agentId]: val }))
    }
    setEditingRateId(null)
  }

  function cancelEditRate() {
    setEditingRateId(null)
  }

  const maxDailyMinutes = Math.max(
    ...agents.flatMap((a) => a.daily.map((d) => d.minutes)),
    1
  )

  if (isLoading && agents.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pay</h2>
          <p className="text-sm text-muted-foreground">
            Track talk time and calculate payroll
          </p>
        </div>
        <button
          onClick={() => setShowRateConfig(!showRateConfig)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            showRateConfig
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 className="h-4 w-4" />
          Pay Rates
        </button>
      </div>

      {showRateConfig && (
        <section className="rounded-xl border border-primary/20 bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Configure Pay Rates</h3>
            <p className="text-xs text-muted-foreground">
              Set each agent{"'"}s per-minute rate. Earnings are calculated automatically.
            </p>
          </div>
          <div className="flex flex-col">
            {agents.map((agent, i) => {
              const isEditing = editingRateId === agent.id
              const isLast = i === agents.length - 1
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    !isLast && "border-b border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={cn(agent.color, "text-primary-foreground text-xs font-semibold")}>
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{agent.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {agent.weeklyMinutes} min this week = {formatCurrency(agent.weeklyMinutes * agent.rate)}
                      </p>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editRateValue}
                        onChange={(e) => setEditRateValue(e.target.value)}
                        className="w-16 rounded-md border border-border bg-secondary px-2 py-1 text-right text-sm text-foreground outline-none focus:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRate(agent.id)
                          if (e.key === "Escape") cancelEditRate()
                        }}
                      />
                      <span className="text-xs text-muted-foreground">/min</span>
                      <button
                        onClick={() => saveRate(agent.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                        aria-label="Save rate"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEditRate}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditRate(agent)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      {agent.rate.toFixed(2)}/min
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <button
          onClick={() => setWeekOffset((w) => Math.max(w - 1, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {getWeekLabel(weekOffset)}
        </span>
        <button
          onClick={() => setWeekOffset((w) => Math.min(w + 1, 0))}
          disabled={weekOffset >= 0}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            weekOffset >= 0
              ? "text-muted-foreground/30"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground leading-tight">
            {formatMinutes(totalMinutes)}
          </p>
          <p className="text-[10px] text-muted-foreground">Total Time</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <Phone className="h-5 w-5 text-success" />
          </div>
          <p className="text-lg font-bold text-foreground leading-tight">
            {totalCalls}
          </p>
          <p className="text-[10px] text-muted-foreground">Total Calls</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
            <DollarSign className="h-5 w-5 text-warning" />
          </div>
          <p className="text-lg font-bold text-foreground leading-tight">
            {formatCurrency(totalPayout)}
          </p>
          <p className="text-[10px] text-muted-foreground">Total Payout</p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2",
          minutesTrend >= 0 ? "bg-success/5" : "bg-destructive/5"
        )}
      >
        {minutesTrend >= 0 ? (
          <TrendingUp className="h-3.5 w-3.5 text-success" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
        )}
        <span
          className={cn(
            "text-xs",
            minutesTrend >= 0 ? "text-success" : "text-destructive"
          )}
        >
          {minutesTrend >= 0 ? "+" : ""}
          {minutesTrend.toFixed(0)}% talk time vs previous week
        </span>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Breakdown
        </h3>
        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            const earnings = agent.weeklyMinutes * agent.rate
            const isExpanded = expandedAgent === agent.id
            const agentTrend = agent.previousWeekMinutes
              ? ((agent.weeklyMinutes - agent.previousWeekMinutes) /
                  agent.previousWeekMinutes) *
                100
              : 0
            return (
              <div
                key={agent.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <button
                  onClick={() =>
                    setExpandedAgent(isExpanded ? null : agent.id)
                  }
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={cn(
                          agent.color,
                          "text-primary-foreground text-xs font-semibold"
                        )}
                      >
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {agent.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {agent.weeklyCalls} calls
                        {" / "}
                        {formatMinutes(agent.weeklyMinutes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-base font-bold text-foreground">
                      {formatCurrency(earnings)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      @ {formatCurrency(agent.rate)}/min
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Per-minute rate
                      </span>
                      {editingRateId === agent.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-muted-foreground">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editRateValue}
                            onChange={(e) => setEditRateValue(e.target.value)}
                            className="w-16 rounded-md border border-border bg-secondary px-2 py-1 text-right text-sm text-foreground outline-none focus:border-primary"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRate(agent.id)
                              if (e.key === "Escape") cancelEditRate()
                            }}
                          />
                          <button
                            onClick={() => saveRate(agent.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                            aria-label="Save rate"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={cancelEditRate}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditRate(agent)}
                          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          {formatCurrency(agent.rate)}/min
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-border">
                      <div className="flex flex-col items-center bg-card px-3 py-3">
                        <span className="text-xs text-muted-foreground">
                          Minutes
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {agent.weeklyMinutes}
                        </span>
                      </div>
                      <div className="flex flex-col items-center bg-card px-3 py-3">
                        <span className="text-xs text-muted-foreground">
                          Rate
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {formatCurrency(agent.rate)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center bg-card px-3 py-3">
                        <span className="text-xs text-muted-foreground">
                          Earned
                        </span>
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(earnings)}
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-4">
                      <p className="mb-3 text-xs font-medium text-muted-foreground">
                        Daily breakdown
                      </p>
                      <div className="flex items-end justify-between gap-1.5">
                        {agent.daily.map((day) => (
                          <div
                            key={day.shortDay}
                            className="flex flex-1 flex-col items-center gap-1.5"
                          >
                            <span className="text-[10px] font-medium text-foreground">
                              {day.minutes > 0 ? `${day.minutes}m` : ""}
                            </span>
                            <div
                              className={cn(
                                "w-full rounded-t-md transition-all",
                                day.minutes > 0
                                  ? agent.color + " opacity-70"
                                  : "bg-secondary"
                              )}
                              style={{
                                height: `${Math.max(
                                  (day.minutes / maxDailyMinutes) * 80,
                                  4
                                )}px`,
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {day.shortDay}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border px-4 py-3">
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          agentTrend >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {agentTrend >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="text-xs">
                          {agentTrend >= 0 ? "+" : ""}
                          {agentTrend.toFixed(0)}% vs previous week (
                          {formatMinutes(agent.previousWeekMinutes)})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">
          Weekly Payout Summary
        </h3>
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground">{agent.name}</span>
              <span className="font-mono font-medium text-foreground">
                {formatMinutes(agent.weeklyMinutes)} ={" "}
                <span className="text-primary">
                  {formatCurrency(agent.weeklyMinutes * agent.rate)}
                </span>
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-primary/20 pt-2 text-sm">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-mono text-lg font-bold text-primary">
              {formatCurrency(totalPayout)}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
