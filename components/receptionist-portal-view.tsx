"use client"

// Receptionist workspace — live status, payout metrics, and personal call ledger.

import { useCallback, useEffect, useState } from "react"
import { Loader2, PhoneCall, PhoneIncoming, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReceptionistPortalDashboard } from "@/lib/types"
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspaceStatCard,
  WorkspaceTableWrap,
  WorkspaceTh,
  WorkspaceTd,
  WORKSPACE_TABLE_ROW_CLASS,
} from "@/components/dashboard-workspace-ui"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith("1"))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function billingCycleLabel(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Current period"
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
}

function LiveStatusPanel({ dashboard }: { dashboard: ReceptionistPortalDashboard }) {
  const { live_status, receptionist } = dashboard
  const onCall = live_status.mode === "on_call"

  return (
    <WorkspacePanel
      className={cn(
        "p-5",
        onCall ? "border-emerald-500/40 bg-emerald-950/20" : "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full",
              onCall ? "bg-emerald-500/20 text-emerald-300" : "bg-primary/15 text-primary"
            )}
          >
            {onCall ? <PhoneCall className="h-5 w-5" aria-hidden /> : <PhoneIncoming className="h-5 w-5" aria-hidden />}
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Live status</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {onCall ? "On an active call" : receptionist.is_active ? "Online & ready" : "Off duty"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {onCall ? (
                <>
                  Answering for <span className="font-medium text-zinc-200">{live_status.business_name}</span>
                  {" · "}
                  {formatPhoneDisplay(live_status.caller_number)}
                  {live_status.caller_name ? ` (${live_status.caller_name})` : ""}
                </>
              ) : (
                <>
                  Waiting for calls routed to <span className="font-medium text-zinc-200">{live_status.business_name}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
            onCall
              ? "bg-emerald-500/15 text-emerald-300"
              : receptionist.is_active
                ? "bg-success/15 text-success"
                : "bg-zinc-800 text-zinc-400"
          )}
        >
          {onCall ? "In call" : receptionist.is_active ? "Available" : "Unavailable"}
        </span>
      </div>
    </WorkspacePanel>
  )
}

export function ReceptionistPortalView() {
  const [dashboard, setDashboard] = useState<ReceptionistPortalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/receptionist/dashboard", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { error?: string; data?: ReceptionistPortalDashboard }
        if (!res.ok) throw new Error(json.error ?? "Could not load dashboard")
        setDashboard(json.data ?? null)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 15_000)
    return () => window.clearInterval(timer)
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        Loading your workspace…
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  if (!dashboard) return null

  const cycleLabel = billingCycleLabel(dashboard.billing_cycle.start, dashboard.billing_cycle.end)

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Your workspace"
        title="Payouts & calls"
        action={
          <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            {dashboard.receptionist.pay_mode === "FLAT_RATE"
              ? `${formatUsd(dashboard.receptionist.flat_rate_usd)} / answered call`
              : `${formatUsd(dashboard.receptionist.rate_per_minute)} / min`}
          </span>
        }
      />

      <LiveStatusPanel dashboard={dashboard} />

      <div className="grid gap-4 sm:grid-cols-3">
        <WorkspaceStatCard
          label="Today's earnings"
          value={formatUsd(dashboard.metrics.today_earnings)}
          hint="Answered calls since midnight UTC"
          accent="primary"
        />
        <WorkspaceStatCard
          label="Current pay period"
          value={formatUsd(dashboard.metrics.pay_period_earnings)}
          hint={cycleLabel}
          accent="success"
        />
        <WorkspaceStatCard
          label="Total active talk time"
          value={`${dashboard.metrics.total_active_talk_minutes} min`}
          hint={`${dashboard.metrics.total_active_talk_seconds}s this pay period`}
        />
      </div>

      <WorkspacePanel className="overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Your call ledger</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Calls routed to you for {dashboard.business_name}. Payout calculated per row.
          </p>
        </div>
        {dashboard.ledger.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No answered calls this pay period yet.</p>
        ) : (
          <WorkspaceTableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <WorkspaceTh>When</WorkspaceTh>
                  <WorkspaceTh>Caller</WorkspaceTh>
                  <WorkspaceTh>Duration</WorkspaceTh>
                  <WorkspaceTh>Status</WorkspaceTh>
                  <WorkspaceTh className="text-right">Your payout</WorkspaceTh>
                </tr>
              </thead>
              <tbody>
                {dashboard.ledger.map((row) => (
                  <tr key={row.id} className={cn(WORKSPACE_TABLE_ROW_CLASS, "border-b border-border/40 last:border-0")}>
                    <WorkspaceTd className="text-zinc-400">{formatTimestamp(row.created_at)}</WorkspaceTd>
                    <WorkspaceTd>
                      <div className="font-medium text-foreground">{formatPhoneDisplay(row.from_number)}</div>
                      {row.caller_name ? <div className="text-xs text-zinc-500">{row.caller_name}</div> : null}
                    </WorkspaceTd>
                    <WorkspaceTd>{formatDuration(row.duration_seconds)}</WorkspaceTd>
                    <WorkspaceTd className="capitalize text-zinc-400">{row.status.replace(/-/g, " ")}</WorkspaceTd>
                    <WorkspaceTd className="text-right font-medium text-foreground">{formatUsd(row.payout_usd)}</WorkspaceTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </WorkspaceTableWrap>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  )
}
