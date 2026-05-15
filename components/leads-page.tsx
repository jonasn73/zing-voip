"use client"

// ============================================
// LeadsPage — AI fallback leads from phone calls
// ============================================
// Fetches AI lead rows from the database (in-app capture).
// Also polls GET /api/calls/live so you can see inbound legs that have not finished yet.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Inbox, Loader2, Phone, MessageSquare, Radio, RefreshCw, Copy, Activity } from "lucide-react"
import { IconSurface } from "@/components/ui/icon-surface"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet"
import { StorySheetHeader } from "@/components/story-sheet-header"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { SITE_NAME } from "@/lib/brand"

/** One row from GET /api/calls/live (subset of call_logs). */
interface LiveCallRow {
  id: string
  from_number: string
  to_number: string
  caller_name: string | null
  status: string
  created_at: string
  duration_seconds: number
}

/** One lead row from GET /api/ai-leads */
interface LeadRow {
  id: string
  caller_e164: string | null
  intent_slug: string | null
  collected: Record<string, unknown>
  summary: string | null
  sms_sent: boolean
  sms_error: string | null
  created_at: string
}

/** Pretty-print intent for badges */
function intentLabel(slug: string | null): string {
  if (!slug) return "Unknown"
  if (slug === "other") return "Other"
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/** Format E.164 for display (US-focused) */
function formatCaller(num: string | null): string {
  if (!num) return "Unknown caller"
  const d = num.replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return num
}

/** Seconds since `iso` for a simple “on call for …” label. `_nowBump` triggers re-computation when the parent ticks each second. */
function secondsSince(iso: string, _nowBump = 0): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 1000))
}

/** Turn Telnyx-ish statuses into short labels for the live strip. */
function liveStatusLabel(status: string): string {
  const s = status.toLowerCase()
  if (s === "ringing") return "Ringing"
  if (s === "in-progress" || s === "answered") return "Connected"
  if (s === "queued" || s === "initiated") return "Starting"
  return status.replace(/-/g, " ")
}

export function LeadsPage() {
  const { toast } = useToast()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leadSheet, setLeadSheet] = useState<LeadRow | null>(null)
  const [liveCalls, setLiveCalls] = useState<LiveCallRow[]>([])
  const [liveTick, setLiveTick] = useState(0)

  const fetchLiveCalls = useCallback(() => {
    fetch("/api/calls/live", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return { calls: [] as LiveCallRow[] }
        const data = (await res.json()) as { calls?: LiveCallRow[] }
        return { calls: Array.isArray(data.calls) ? data.calls : [] }
      })
      .then(({ calls }) => {
        setLiveCalls(calls)
      })
      .catch(() => {
        setLiveCalls([])
      })
  }, [])

  useEffect(() => {
    void fetchLiveCalls()
    const id = window.setInterval(() => void fetchLiveCalls(), 10_000)
    return () => window.clearInterval(id)
  }, [fetchLiveCalls])

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/ai-leads", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || "Could not load leads")
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setLeads(Array.isArray(data.leads) ? data.leads : [])
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 sm:gap-7">
      <div className="flex items-center gap-3">
        <IconSurface tone="primary">
          <Inbox className="h-5 w-5" />
        </IconSurface>
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI leads</h1>
          <p className="text-xs text-muted-foreground">
            Captured when the AI receptionist takes a call (no answer / busy fallback).
          </p>
        </div>
      </div>

      <section
        aria-label="Live calls on your business lines"
        className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio
              className={cn("h-4 w-4 shrink-0 text-primary", liveCalls.length > 0 && "animate-pulse")}
              aria-hidden
            />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Live calls</h2>
              <p className="text-[11px] text-muted-foreground">
                Inbound legs still open in our logs (updates about every 10s). Not a carrier-grade real-time feed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchLiveCalls()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Refresh live calls"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {liveCalls.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No active calls right now — when someone dials your {SITE_NAME} number you should see them here while the
            line is ringing or connected.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {liveCalls.map((c) => {
              const elapsed = secondsSince(c.created_at, liveTick)
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                        {liveStatusLabel(c.status)}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">{formatCaller(c.from_number)}</span>
                      {c.caller_name ? (
                        <span className="truncate text-[11px] text-muted-foreground">({c.caller_name})</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      To {formatCaller(c.to_number)} · about {elapsed}s on record
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const raw = c.from_number?.trim()
                        if (!raw) return
                        void navigator.clipboard.writeText(raw).then(
                          () => {
                            toast({ title: "Copied", description: "Caller number is on your clipboard." })
                          },
                          () => {
                            toast({
                              title: "Could not copy",
                              description: "Select the number and copy manually.",
                              variant: "destructive",
                            })
                          }
                        )
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy
                    </button>
                    <Link
                      href="/dashboard/activity"
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Activity className="h-3.5 w-3.5" aria-hidden />
                      Activity
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : leads.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          No leads yet. When a caller speaks with your AI assistant and it saves their details, they will show up
          here and (if SMS is on) text your main line.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => setLeadSheet(lead)}
                className="w-full rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {intentLabel(lead.intent_slug)}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {formatCaller(lead.caller_e164)}
                  </span>
                  {lead.sms_sent ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success">
                      <MessageSquare className="h-3 w-3" />
                      Text sent
                    </span>
                  ) : lead.sms_error ? (
                    <span className="text-[11px] text-warning">SMS: {lead.sms_error}</span>
                  ) : null}
                </div>
                {lead.summary ? (
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{lead.summary}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(lead.created_at).toLocaleString()} · tap for full capture
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={leadSheet != null} onOpenChange={(o) => !o && setLeadSheet(null)} modal>
        <SheetContent side="bottom" className="gap-0 p-0 sm:mx-auto sm:max-w-lg [&>button]:top-3">
          {leadSheet ? (
            <>
              <StorySheetHeader
                eyebrow="AI intake story"
                storyline="What the assistant heard and saved — the same thread your routing promised callers."
                title={intentLabel(leadSheet.intent_slug)}
                description={
                  <>
                    Caller {formatCaller(leadSheet.caller_e164)} · {new Date(leadSheet.created_at).toLocaleString()}
                    {leadSheet.sms_sent ? (
                      <span className="mt-1 block text-success">SMS confirmation sent to your line.</span>
                    ) : null}
                    {leadSheet.sms_error ? (
                      <span className="mt-1 block text-warning">SMS: {leadSheet.sms_error}</span>
                    ) : null}
                  </>
                }
              />
              {leadSheet.summary ? (
                <p className="border-b border-border/60 px-4 py-3 text-sm font-medium text-foreground">{leadSheet.summary}</p>
              ) : null}
              <div className="max-h-[min(55vh,420px)] overflow-y-auto px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Captured fields</p>
                <pre className="whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-[11px] leading-relaxed text-foreground">
                  {JSON.stringify(leadSheet.collected, null, 2)}
                </pre>
              </div>
              <SheetFooter className="border-t border-border/70 bg-secondary/15 px-4 py-3">
                <p className="text-[11px] text-muted-foreground">
                  Tune how the assistant asks on{" "}
                  <a href="/dashboard" className="font-semibold text-primary underline-offset-2 hover:underline">
                    Call flow
                  </a>{" "}
                  → Voice &amp; greetings.
                </p>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
