"use client"

import { useMemo, useState, useEffect } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneMissed,
  Voicemail,
  Clock,
  Search,
  Filter,
  Download,
  Phone,
  Gauge,
  CheckCircle2,
  Timer,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type CallType = "incoming" | "outgoing" | "missed" | "voicemail"
type FilterType = "all" | CallType

interface CallRecord {
  id: string
  type: CallType
  callerName: string
  callerNumber: string
  routedTo: string
  routedInitials: string
  routedColor: string
  date: string
  time: string
  durationSeconds: number
  hasRecording: boolean
  recordingUrl: string | null
}

interface VoiceQualitySummary {
  total_calls: number
  answered_calls: number
  answer_rate_percent: number
  avg_setup_ms: number | null
  p95_setup_ms: number | null
  avg_post_dial_delay_ms: number | null
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "--"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

function formatDurationLong(seconds: number): string {
  if (seconds === 0) return "No call duration"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m} min ${s} sec`
  return `${s} seconds`
}

const callTypeConfig: Record<CallType, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  incoming: { icon: ArrowDownLeft, label: "Incoming", color: "text-success", bgColor: "bg-success/10" },
  outgoing: { icon: ArrowUpRight, label: "Outgoing", color: "text-primary", bgColor: "bg-primary/10" },
  missed: { icon: PhoneMissed, label: "Missed", color: "text-destructive", bgColor: "bg-destructive/10" },
  voicemail: { icon: Voicemail, label: "Voicemail", color: "text-warning", bgColor: "bg-warning/10" },
}

function formatPhoneDisplay(phone: string | undefined | null): string {
  const v = String(phone || "")
  if (!v) return "Unknown"
  const digits = v.replace(/\D/g, "")
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return v
}

function getDateLabel(d: Date): string {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.floor((startToday - startThatDay) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0] || "NA").slice(0, 2).toUpperCase()
}

export function ActivityPage() {
  const [filter, setFilter] = useState<FilterType>("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [quality, setQuality] = useState<VoiceQualitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "incoming", label: "Incoming" },
    { id: "outgoing", label: "Outgoing" },
    { id: "missed", label: "Missed" },
    { id: "voicemail", label: "Voicemail" },
  ]

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setLoadError(null)
      try {
        const [callsRes, qualityRes] = await Promise.all([
          fetch("/api/calls?limit=100", { credentials: "include" }),
          fetch("/api/voice/quality?days=7", { credentials: "include" }),
        ])

        if (!callsRes.ok) throw new Error("Failed to load calls")
        const callsData = await callsRes.json()
        const normalizedCalls: CallRecord[] = Array.isArray(callsData.calls)
          ? callsData.calls.map((c: Record<string, unknown>) => {
            const type = String(c.call_type || "incoming") as CallType
            const createdAtRaw = String(c.created_at || "")
            const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date()
            const routedTo = String(c.routed_to_name || c.routed_to_receptionist_id || "Owner")
            return {
              id: String(c.id || c.twilio_call_sid || crypto.randomUUID()),
              type: type === "incoming" || type === "outgoing" || type === "missed" || type === "voicemail" ? type : "incoming",
              callerName: String(c.caller_name || "Unknown Caller"),
              callerNumber: formatPhoneDisplay(String(c.from_number || "")),
              routedTo,
              routedInitials: initialsFromName(routedTo),
              routedColor: "bg-primary",
              date: getDateLabel(createdAt),
              time: createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              durationSeconds: Number(c.duration_seconds || 0),
              hasRecording: Boolean(c.has_recording),
              recordingUrl: c.recording_url ? String(c.recording_url) : null,
            }
          })
          : []

        let qualitySummary: VoiceQualitySummary | null = null
        if (qualityRes.ok) {
          const q = await qualityRes.json()
          if (q?.summary) qualitySummary = q.summary as VoiceQualitySummary
        }

        if (!mounted) return
        setCalls(normalizedCalls)
        setQuality(qualitySummary)
      } catch (e) {
        if (!mounted) return
        setLoadError(e instanceof Error ? e.message : "Failed to load activity")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.callerName.toLowerCase().includes(q) ||
          c.callerNumber.includes(q) ||
          c.routedTo.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [calls, filter, search])

  const totalCalls = calls.length
  const totalDuration = calls.reduce((sum, c) => sum + c.durationSeconds, 0)
  const recordingsCount = calls.filter((c) => c.hasRecording).length

  const grouped = useMemo(() => {
    const bucket: Record<string, CallRecord[]> = {}
    for (const call of filtered) {
      if (!bucket[call.date]) bucket[call.date] = []
      bucket[call.date].push(call)
    }
    return bucket
  }, [filtered])

  const answerRate = quality?.answer_rate_percent ?? 0
  const avgSetup = quality?.avg_setup_ms ?? null
  const p95Setup = quality?.p95_setup_ms ?? null

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* Core KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Phone className="mb-1 h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">{totalCalls}</span>
          <span className="text-[10px] text-muted-foreground">Total Calls</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Clock className="mb-1 h-4 w-4 text-warning" />
          <span className="text-lg font-bold text-foreground">
            {Math.floor(totalDuration / 60)}m
          </span>
          <span className="text-[10px] text-muted-foreground">Talk Time</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Download className="mb-1 h-4 w-4 text-success" />
          <span className="text-lg font-bold text-foreground">{recordingsCount}</span>
          <span className="text-[10px] text-muted-foreground">Recordings</span>
        </div>
      </div>

      {/* Quality KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <CheckCircle2 className="mb-1 h-4 w-4 text-success" />
          <span className="text-lg font-bold text-foreground">{answerRate.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground">Answer Rate</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Gauge className="mb-1 h-4 w-4 text-warning" />
          <span className="text-lg font-bold text-foreground">
            {avgSetup == null ? "--" : `${Math.round(avgSetup)}ms`}
          </span>
          <span className="text-[10px] text-muted-foreground">Avg Setup</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Timer className="mb-1 h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">
            {p95Setup == null ? "--" : `${Math.round(p95Setup)}ms`}
          </span>
          <span className="text-[10px] text-muted-foreground">P95 Setup</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search calls, contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            role="tab"
            aria-selected={filter === f.id}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Call Records by Date */}
      {loading && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading call activity...
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {Object.entries(grouped).map(([date, calls]) => (
        <section key={date}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </h3>
          <div className="flex flex-col gap-2">
            {calls.map((call) => {
              const config = callTypeConfig[call.type]
              const Icon = config.icon
              const isExpanded = expandedId === call.id

              return (
                <div key={call.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : call.id)}
                    className="flex w-full items-center justify-between p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", config.bgColor)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {call.callerName}
                        </p>
                        <p className="text-xs text-muted-foreground">{call.callerNumber}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{call.time}</span>
                      <div className="flex items-center gap-1.5">
                        {call.durationSeconds > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(call.durationSeconds)}
                          </span>
                        )}
                        {call.hasRecording && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border px-3.5 pb-3.5 pt-3 flex flex-col gap-3">
                      {/* Details Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Routed To</span>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className={cn(call.routedColor, "text-primary-foreground text-[8px] font-bold")}>
                                {call.routedInitials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{call.routedTo}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</span>
                          <span className="text-sm font-medium text-foreground">
                            {formatDurationLong(call.durationSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Recording Player */}
                      {call.hasRecording ? (
                        <div>
                          <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                            Recording
                          </span>
                          {call.recordingUrl ? (
                            <a
                              href={call.recordingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-xs text-foreground hover:bg-secondary"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open recording
                            </a>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2.5">
                              <Voicemail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Recording not available yet</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2.5">
                          <Voicemail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">No recording available</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12">
          <Filter className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No calls match your filters</p>
        </div>
      )}
    </div>
  )
}
