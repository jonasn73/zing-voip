"use client"

// ============================================
// AI Call Flow — dashboard to pick industry playbook,
// see branch flow, and edit intake fields (saved to user_ai_intake + Vapi when active).
// ============================================

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, ChevronRight, Loader2, Save, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { IconSurface } from "@/components/ui/icon-surface"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { getIntakeFlowSummary } from "@/lib/ai-intake-flow-summaries"
import {
  type AiIntakeProfileId,
  AI_INTAKE_PROFILE_IDS,
  INDUSTRY_CATALOG,
  defaultProfileFromUserIndustry,
  industryLabel,
  isAiIntakeProfileId,
} from "@/lib/business-industries"
import { DEFAULT_BUSY_GREETING_LOCKSMITH } from "@/lib/ai-intake-defaults"

/** Build the JSON object PATCH /api/ai-assistant expects for intake (same shape as Settings). */
function buildIntakeBody(
  scriptChoice: "auto" | AiIntakeProfileId,
  aiIntake: {
    busyGreeting: string
    carKeyNotes: string
    lockoutNotes: string
    otherNotes: string
    smsNotify: boolean
  }
) {
  return {
    ...(scriptChoice === "auto" ? { followIndustryForAi: true } : { profileId: scriptChoice }),
    busyGreeting: aiIntake.busyGreeting,
    carKeyNotes: aiIntake.carKeyNotes,
    lockoutNotes: aiIntake.lockoutNotes,
    otherNotes: aiIntake.otherNotes,
    smsNotify: aiIntake.smsNotify,
  }
}

export function AiIntakeFlowPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true) // true until first GET /api/ai-assistant finishes
  const [loadError, setLoadError] = useState<string | null>(null) // shown if /api/ai-assistant fails (still allow editing)
  const [saving, setSaving] = useState(false) // true while PATCH runs
  const [activating, setActivating] = useState(false) // true while POST create assistant runs
  const [hasAssistant, setHasAssistant] = useState(false) // whether Vapi assistant id exists
  const [userIndustry, setUserIndustry] = useState<string>("generic") // from session — used when script is “auto”
  const [scriptChoice, setScriptChoice] = useState<"auto" | AiIntakeProfileId>("auto") // playbook picker
  const [aiIntake, setAiIntake] = useState({
    busyGreeting: "",
    carKeyNotes: "",
    lockoutNotes: "",
    otherNotes: "",
    smsNotify: true,
  })

  // Which playbook the flow diagram reflects (auto → infer from signup industry)
  const previewProfileId = useMemo(
    () => (scriptChoice === "auto" ? defaultProfileFromUserIndustry(userIndustry) : scriptChoice),
    [scriptChoice, userIndustry]
  )
  const flow = useMemo(() => getIntakeFlowSummary(previewProfileId), [previewProfileId])
  const showLocksmithExtras = previewProfileId === "locksmith"

  // Load session (industry) + assistant + intake
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch("/api/auth/session", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/ai-assistant", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sessionData, aiData]) => {
        if (cancelled) return
        if (!aiData) {
          setLoadError("Could not load saved settings. You can still edit below; try Save again in a moment.")
          return
        }
        setLoadError(null)
        const ind = sessionData?.data?.user?.industry
        if (typeof ind === "string") setUserIndustry(ind)

        setHasAssistant(Boolean(aiData.hasAssistant))

        const stored = aiData.intakeStored as Record<string, unknown> | null | undefined
        const storedPid = stored && typeof stored.profileId === "string" ? stored.profileId : ""
        if (storedPid && isAiIntakeProfileId(storedPid)) setScriptChoice(storedPid)
        else setScriptChoice("auto")

        const config = aiData.assistantConfig as Record<string, unknown> | null
        const cfgFirst = config ? String(config.firstMessage || "") : ""
        const ic = aiData.intakeConfig as
          | {
              busyGreeting?: string
              carKeyNotes?: string
              lockoutNotes?: string
              otherNotes?: string
              smsNotify?: boolean
            }
          | undefined

        if (ic) {
          setAiIntake({
            busyGreeting: (ic.busyGreeting && ic.busyGreeting.trim()) || cfgFirst || "",
            carKeyNotes: ic.carKeyNotes || "",
            lockoutNotes: ic.lockoutNotes || "",
            otherNotes: ic.otherNotes || "",
            smsNotify: ic.smsNotify !== false,
          })
        } else if (cfgFirst) {
          setAiIntake((p) => ({ ...p, busyGreeting: cfgFirst }))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const greeting = aiIntake.busyGreeting.trim() || undefined
      const res = await fetch("/api/ai-assistant", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake: buildIntakeBody(scriptChoice, aiIntake),
          greeting,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Could not save", description: String(data.error || res.statusText), variant: "destructive" })
        return
      }
      toast({
        title: "Saved",
        description: String(data.message || "Call flow and intake settings updated."),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    setActivating(true)
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          greeting: aiIntake.busyGreeting.trim() || undefined,
          intake: buildIntakeBody(scriptChoice, aiIntake),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Activate failed", description: String(data.error || res.statusText), variant: "destructive" })
        return
      }
      if (data.assistantId) setHasAssistant(true)
      toast({ title: "Voice AI on", description: String(data.message || "Assistant is live for fallback calls.") })
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading your call flow…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-28">
      {loadError && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
          {loadError}
        </div>
      )}
      {/* Page title */}
      <div>
        <div className="flex items-center gap-2">
          <IconSurface tone="primary" className="h-10 w-10">
            <Bot className="h-5 w-5 text-primary" />
          </IconSurface>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI call flow</h1>
            <p className="text-[11px] text-muted-foreground">
              Industry intake when nobody answers — branches, fields, and your opening line.
            </p>
          </div>
        </div>
      </div>

      {/* Status: Vapi on or needs activation */}
      <div
        className={cn(
          "rounded-2xl border px-4 py-3",
          hasAssistant ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/10"
        )}
      >
        <p className="text-xs font-semibold text-foreground">
          {hasAssistant ? "Voice assistant is active" : "Voice assistant not active yet"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {hasAssistant
            ? "Fallback → AI uses the playbook below on live calls."
            : "With AI fallback on, callers need an activated assistant — otherwise they hear voicemail. Save your flow first, then activate."}
        </p>
        {!hasAssistant && (
          <button
            type="button"
            disabled={activating}
            onClick={() => void handleActivate()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {activating ? "Activating…" : "Activate voice assistant"}
          </button>
        )}
      </div>

      {/* Playbook + flow diagram */}
      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Playbook</p>
        <select
          value={scriptChoice}
          onChange={(e) => {
            const v = e.target.value
            setScriptChoice(v === "auto" ? "auto" : (v as AiIntakeProfileId))
          }}
          className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="auto">Auto — match my industry ({industryLabel(userIndustry)})</option>
          {AI_INTAKE_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {INDUSTRY_CATALOG.find((r) => r.id === id)?.label ?? id}
            </option>
          ))}
        </select>

        <div className="rounded-xl bg-primary/5 px-3 py-2">
          <p className="text-[10px] font-medium text-primary">Flow preview — {flow.label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{flow.goal}</p>
        </div>

        <div className="space-y-2">
          {flow.branches.map((b, idx) => (
            <div
              key={`${b.intent_slug}-${idx}`}
              className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{b.title}</p>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                  {b.intent_slug}
                </span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {b.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Editable intake fields */}
      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What callers hear first</p>
        <textarea
          value={aiIntake.busyGreeting}
          onChange={(e) => setAiIntake((p) => ({ ...p, busyGreeting: e.target.value }))}
          rows={4}
          placeholder={DEFAULT_BUSY_GREETING_LOCKSMITH}
          className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        {showLocksmithExtras && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Extra — car keys</label>
              <textarea
                value={aiIntake.carKeyNotes}
                onChange={(e) => setAiIntake((p) => ({ ...p, carKeyNotes: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Extra — lockouts</label>
              <textarea
                value={aiIntake.lockoutNotes}
                onChange={(e) => setAiIntake((p) => ({ ...p, lockoutNotes: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground">Extra notes — all scripts</label>
          <textarea
            value={aiIntake.otherNotes}
            onChange={(e) => setAiIntake((p) => ({ ...p, otherNotes: e.target.value }))}
            rows={2}
            placeholder="Anything you want the AI to always remember for your business"
            className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Text me new leads</p>
            <p className="text-[10px] text-muted-foreground">SMS when a lead is saved (needs Telnyx messaging env).</p>
          </div>
          <Switch
            checked={aiIntake.smsNotify}
            onCheckedChange={(v) => setAiIntake((p) => ({ ...p, smsNotify: v }))}
            aria-label="SMS lead notifications"
          />
        </div>
      </section>

      {/* Link to full voice settings */}
      <Link
        href="/dashboard/settings"
        className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
      >
        <span>Voice, limits, presets</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save call flow"}
        </button>
      </div>
    </div>
  )
}
