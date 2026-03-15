"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Play,
  Pause,
  ArrowDownLeft,
  ArrowUpRight,
  PhoneMissed,
  Voicemail,
  Clock,
  Search,
  Filter,
  Download,
  Phone,
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
}

const callRecords: CallRecord[] = [
  {
    id: "1", type: "incoming", callerName: "Acme Corp", callerNumber: "(555) 111-2222",
    routedTo: "Sarah Miller", routedInitials: "SM", routedColor: "bg-primary",
    date: "Today", time: "2:34 PM", durationSeconds: 423, hasRecording: true,
  },
  {
    id: "2", type: "outgoing", callerName: "Follow Up - Johnson", callerNumber: "(555) 333-4444",
    routedTo: "You", routedInitials: "YO", routedColor: "bg-chart-2",
    date: "Today", time: "1:12 PM", durationSeconds: 187, hasRecording: true,
  },
  {
    id: "3", type: "missed", callerName: "Unknown Caller", callerNumber: "(555) 555-6666",
    routedTo: "Voicemail", routedInitials: "VM", routedColor: "bg-destructive",
    date: "Today", time: "11:45 AM", durationSeconds: 0, hasRecording: false,
  },
  {
    id: "4", type: "voicemail", callerName: "David Chen", callerNumber: "(555) 777-8888",
    routedTo: "Voicemail", routedInitials: "DC", routedColor: "bg-chart-5",
    date: "Today", time: "10:20 AM", durationSeconds: 45, hasRecording: true,
  },
  {
    id: "5", type: "incoming", callerName: "Maria Santos", callerNumber: "(555) 999-0000",
    routedTo: "Sarah Miller", routedInitials: "SM", routedColor: "bg-primary",
    date: "Yesterday", time: "4:56 PM", durationSeconds: 612, hasRecording: true,
  },
  {
    id: "6", type: "incoming", callerName: "TechStart Inc", callerNumber: "(555) 222-3333",
    routedTo: "James Wilson", routedInitials: "JW", routedColor: "bg-chart-2",
    date: "Yesterday", time: "3:18 PM", durationSeconds: 298, hasRecording: true,
  },
  {
    id: "7", type: "outgoing", callerName: "Client Callback", callerNumber: "(555) 444-5555",
    routedTo: "You", routedInitials: "YO", routedColor: "bg-chart-2",
    date: "Yesterday", time: "1:05 PM", durationSeconds: 145, hasRecording: false,
  },
  {
    id: "8", type: "missed", callerName: "Spam Likely", callerNumber: "(555) 666-7777",
    routedTo: "Voicemail", routedInitials: "VM", routedColor: "bg-destructive",
    date: "Yesterday", time: "9:30 AM", durationSeconds: 0, hasRecording: false,
  },
  {
    id: "9", type: "incoming", callerName: "Big Deal Vendor", callerNumber: "(555) 888-9999",
    routedTo: "Rachel Kim", routedInitials: "RK", routedColor: "bg-chart-5",
    date: "Feb 23", time: "5:42 PM", durationSeconds: 934, hasRecording: true,
  },
  {
    id: "10", type: "voicemail", callerName: "Insurance Co", callerNumber: "(555) 123-9876",
    routedTo: "Voicemail", routedInitials: "VM", routedColor: "bg-chart-5",
    date: "Feb 23", time: "2:15 PM", durationSeconds: 62, hasRecording: true,
  },
]

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

function AudioPlayer({ callId }: { callId: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fakeDuration = 30 + (parseInt(callId) * 7) % 60 // deterministic fake duration

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function togglePlay() {
    if (isPlaying) {
      stopPlayback()
    } else {
      setIsPlaying(true)
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            stopPlayback()
            return 0
          }
          const next = prev + (100 / (fakeDuration * 10))
          setCurrentTime(Math.floor((next / 100) * fakeDuration))
          return next
        })
      }, 100)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5">
      <button
        onClick={togglePlay}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
          isPlaying
            ? "bg-primary text-primary-foreground"
            : "bg-primary/20 text-primary hover:bg-primary/30"
        )}
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, "0")}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.floor(fakeDuration / 60)}:{(fakeDuration % 60).toString().padStart(2, "0")}
          </span>
        </div>
      </div>
      <button
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Download recording"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ActivityPage() {
  const [filter, setFilter] = useState<FilterType>("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "incoming", label: "Incoming" },
    { id: "outgoing", label: "Outgoing" },
    { id: "missed", label: "Missed" },
    { id: "voicemail", label: "Voicemail" },
  ]

  const filtered = callRecords.filter((c) => {
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

  const totalCalls = callRecords.length
  const totalDuration = callRecords.reduce((sum, c) => sum + c.durationSeconds, 0)
  const recordingsCount = callRecords.filter((c) => c.hasRecording).length

  // Group by date
  const grouped: Record<string, CallRecord[]> = {}
  for (const call of filtered) {
    if (!grouped[call.date]) grouped[call.date] = []
    grouped[call.date].push(call)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* Header Stats */}
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
          <Play className="mb-1 h-4 w-4 text-success" />
          <span className="text-lg font-bold text-foreground">{recordingsCount}</span>
          <span className="text-[10px] text-muted-foreground">Recordings</span>
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
                          <AudioPlayer callId={call.id} />
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
