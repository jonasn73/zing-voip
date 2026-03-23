"use client"

// ============================================
// Playbook + intake + Telnyx Voice AI id (shared: full page or fallback modal)
// ============================================

import { useEffect, useId, useMemo, useState } from "react"
import { Bot, ChevronDown, Loader2, Save } from "lucide-react"
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

function buildIntakeBody(
  scriptChoice: "auto" | AiIntakeProfileId,
  aiIntake: {
    busyGreeting: string
    carKeyNotes: string
    lockoutNotes: string
    otherNotes: string
    smsNotify: boolean
  },
  aiAdvanced: { telnyxModel: string; telnyxVoice: string; extraAiInstructions: string }
) {
  return {
    ...(scriptChoice === "auto" ? { followIndustryForAi: true } : { profileId: scriptChoice }),
    busyGreeting: aiIntake.busyGreeting,
    carKeyNotes: aiIntake.carKeyNotes,
    lockoutNotes: aiIntake.lockoutNotes,
    otherNotes: aiIntake.otherNotes,
    smsNotify: aiIntake.smsNotify,
    telnyxModel: aiAdvanced.telnyxModel,
    telnyxVoice: aiAdvanced.telnyxVoice,
    extraAiInstructions: aiAdvanced.extraAiInstructions,
  }
}

export type AiIntakeFlowPanelVariant = "page" | "modal"

export function AiIntakeFlowPanel({
  variant = "page",
  onHasAssistantChange,
  onBusyGreetingSavedToRouting,
  /** Dashboard sets this when /api/routing auto-provisions after choosing AI fallback (panel may not refetch yet). */
  externalAssistantLinked,
}: {
  variant?: AiIntakeFlowPanelVariant
  onHasAssistantChange?: (active: boolean) => void
  onBusyGreetingSavedToRouting?: (text: string) => void
  externalAssistantLinked?: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasAssistant, setHasAssistant] = useState(false)
  const [userIndustry, setUserIndustry] = useState<string>("generic")
  /** Optional override — Zing normally creates the Telnyx assistant for you (see Advanced). */
  const [telnyxAssistantId, setTelnyxAssistantId] = useState("")
  /** Show the rare “paste an existing assistant id” field (support / migrations). */
  const [showAdvancedAssistantId, setShowAdvancedAssistantId] = useState(false)
  const [scriptChoice, setScriptChoice] = useState<"auto" | AiIntakeProfileId>("auto")
  const [aiIntake, setAiIntake] = useState({
    busyGreeting: "",
    carKeyNotes: "",
    lockoutNotes: "",
    otherNotes: "",
    smsNotify: true,
  })
  /** Optional LLM / TTS / extra prompt — stored in user_ai_intake.config, synced to Telnyx on save/activate. */
  const [aiAdvanced, setAiAdvanced] = useState({
    telnyxModel: "",
    telnyxVoice: "",
    extraAiInstructions: "",
  })
  const [showAdvancedAi, setShowAdvancedAi] = useState(false)
  const [modelOptions, setModelOptions] = useState<{ id: string }[]>([])
  const [voiceOptions, setVoiceOptions] = useState<{ id: string; label: string }[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const modelListId = useId()
  const voiceListId = useId()

  const previewProfileId = useMemo(
    () => (scriptChoice === "auto" ? defaultProfileFromUserIndustry(userIndustry) : scriptChoice),
    [scriptChoice, userIndustry]
  )
  const flow = useMemo(() => getIntakeFlowSummary(previewProfileId), [previewProfileId])
  const showLocksmithExtras = previewProfileId === "locksmith"
  /** True when GET /api/ai-assistant said linked or parent just provisioned via routing. */
  const assistantReady = hasAssistant || Boolean(externalAssistantLinked)

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

        const has = Boolean(aiData.hasAssistant)
        setHasAssistant(has)

        const aid = typeof aiData.assistantId === "string" ? aiData.assistantId : ""
        setTelnyxAssistantId(aid)

        const stored = aiData.intakeStored as Record<string, unknown> | null | undefined
        const storedPid = stored && typeof stored.profileId === "string" ? stored.profileId : ""
        if (storedPid && isAiIntakeProfileId(storedPid)) setScriptChoice(storedPid)
        else setScriptChoice("auto")

        const ic = aiData.intakeConfig as
          | {
              busyGreeting?: string
              carKeyNotes?: string
              lockoutNotes?: string
              otherNotes?: string
              smsNotify?: boolean
              telnyxModel?: string
              telnyxVoice?: string
              extraAiInstructions?: string
            }
          | undefined

        if (ic) {
          setAiIntake({
            busyGreeting: (ic.busyGreeting && ic.busyGreeting.trim()) || "",
            carKeyNotes: ic.carKeyNotes || "",
            lockoutNotes: ic.lockoutNotes || "",
            otherNotes: ic.otherNotes || "",
            smsNotify: ic.smsNotify !== false,
          })
          setAiAdvanced({
            telnyxModel: typeof ic.telnyxModel === "string" ? ic.telnyxModel : "",
            telnyxVoice: typeof ic.telnyxVoice === "string" ? ic.telnyxVoice : "",
            extraAiInstructions: typeof ic.extraAiInstructions === "string" ? ic.extraAiInstructions : "",
          })
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

  useEffect(() => {
    if (!showAdvancedAi) return
    let cancelled = false
    setCatalogLoading(true)
    Promise.all([
      fetch("/api/ai-assistant/models", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/ai-assistant/voices", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([m, v]) => {
        if (cancelled) return
        setModelOptions(Array.isArray(m.models) ? m.models : [])
        setVoiceOptions(Array.isArray(v.voices) ? v.voices : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showAdvancedAi])

  async function handleSave() {
    setSaving(true)
    try {
      const greeting = aiIntake.busyGreeting.trim() || undefined
      const res = await fetch("/api/ai-assistant", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake: buildIntakeBody(scriptChoice, aiIntake, aiAdvanced),
          greeting,
          // Omit when Advanced is closed so we never wipe a server-created assistant id with an empty string.
          ...(showAdvancedAssistantId ? { telnyxAiAssistantId: telnyxAssistantId.trim() } : {}),
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
      const g = aiIntake.busyGreeting.trim()
      if (g) onBusyGreetingSavedToRouting?.(g)
      if (telnyxAssistantId.trim()) {
        setHasAssistant(true)
        onHasAssistantChange?.(true)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2",
          variant === "page" ? "min-h-[50vh] px-4" : "py-8"
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <p className="text-xs text-muted-foreground">Loading call flow…</p>
      </div>
    )
  }

  const inner = (
    <>
      {loadError && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
          {loadError}
        </div>
      )}

      {variant === "page" && (
        <div>
          <div className="flex items-center gap-2">
            <IconSurface tone="primary" className="h-10 w-10">
              <Bot className="h-5 w-5 text-primary" />
            </IconSurface>
            <div>
              <h1 className="text-lg font-bold text-foreground">AI call flow</h1>
              <p className="text-[11px] text-muted-foreground">
                Industry intake notes + Telnyx Voice AI on no-answer (same carrier, one stack).
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-2 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Telnyx Voice AI</p>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          When you choose <span className="font-medium text-foreground">AI receptionist</span> in Fallback Settings, Zing
          creates the assistant on your account automatically — no extra step. Saving here updates how it talks and what
          it collects.
        </p>
        <button
          type="button"
          onClick={() => setShowAdvancedAssistantId((v) => !v)}
          className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {showAdvancedAssistantId ? "Hide advanced" : "Advanced — link an existing assistant id"}
        </button>
        {showAdvancedAssistantId && (
          <>
            <input
              type="text"
              value={telnyxAssistantId}
              onChange={(e) => setTelnyxAssistantId(e.target.value)}
              placeholder="Only if support gave you an id to paste"
              className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">
              If this field is filled, Activate uses this id instead of creating a new assistant.
            </p>
          </>
        )}
      </section>

      <div
        className={cn(
          "rounded-2xl border px-4 py-3",
          assistantReady ? "border-success/30 bg-success/5" : "border-border/80 bg-secondary/30"
        )}
      >
        <p className="text-xs font-semibold text-foreground">
          {assistantReady ? "Voice assistant is active" : "Voice assistant will turn on with AI fallback"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {assistantReady
            ? "No-answer calls connect to this Telnyx assistant on the same line. Use Save below to push script changes."
            : "Select AI receptionist in Fallback Settings on the dashboard — Zing creates your assistant automatically. Then refine the playbook here."}
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvancedAi((v) => !v)}
          className="flex w-full items-start justify-between gap-2 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Voice &amp; model (power users)
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Optional LLM, speaking voice, and extra instructions — we push these to Telnyx when you Save or Activate.
            </p>
          </div>
          <ChevronDown
            className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", showAdvancedAi && "rotate-180")}
            aria-hidden
          />
        </button>
        {showAdvancedAi && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            {catalogLoading ? (
              <p className="text-[10px] text-muted-foreground">Loading Telnyx model and voice lists…</p>
            ) : null}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${modelListId}-input`}>
                LLM model
              </label>
              <input
                id={`${modelListId}-input`}
                type="text"
                list={modelListId}
                value={aiAdvanced.telnyxModel}
                onChange={(e) => setAiAdvanced((p) => ({ ...p, telnyxModel: e.target.value }))}
                placeholder="Empty = platform default (see Vercel TELNYX_AI_DEFAULT_MODEL)"
                className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                autoComplete="off"
              />
              <datalist id={modelListId}>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${voiceListId}-input`}>
                Speaking voice
              </label>
              <input
                id={`${voiceListId}-input`}
                type="text"
                list={voiceListId}
                value={aiAdvanced.telnyxVoice}
                onChange={(e) => setAiAdvanced((p) => ({ ...p, telnyxVoice: e.target.value }))}
                placeholder="Empty = platform default (TELNYX_AI_VOICE)"
                className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                autoComplete="off"
              />
              <datalist id={voiceListId}>
                {voiceOptions.map((v) => (
                  <option key={v.id} value={v.id} label={v.label} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Extra instructions for the AI</label>
              <textarea
                value={aiAdvanced.extraAiInstructions}
                onChange={(e) => setAiAdvanced((p) => ({ ...p, extraAiInstructions: e.target.value }))}
                rows={4}
                placeholder="Anything else the assistant must follow (policies, pricing tone, languages, tools you use in Telnyx, etc.)"
                className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Simple:</span> leave blank — defaults apply.{" "}
              <span className="font-medium text-foreground">More control:</span> set model/voice/text here.{" "}
              <span className="font-medium text-foreground">Full Telnyx UI:</span> use &quot;Advanced — link an existing
              assistant id&quot; above.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Playbook (reference)</p>
        <p className="text-[10px] text-muted-foreground">
          This is what we send as your assistant&apos;s instructions when you activate or save.
        </p>
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

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          What callers hear first (voicemail / routing)
        </p>
        <p className="text-[10px] text-muted-foreground">
          Also used as the first thing the Voice AI says when fallback picks up — synced to Telnyx on Save/Activate.
        </p>
        <textarea
          value={aiIntake.busyGreeting}
          onChange={(e) => setAiIntake((p) => ({ ...p, busyGreeting: e.target.value }))}
          rows={variant === "modal" ? 3 : 4}
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
                className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Extra — lockouts</label>
              <textarea
                value={aiIntake.lockoutNotes}
                onChange={(e) => setAiIntake((p) => ({ ...p, lockoutNotes: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm"
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
            placeholder="Paste into Telnyx assistant instructions as needed"
            className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Text me new leads</p>
            <p className="text-[10px] text-muted-foreground">SMS when a lead is saved (Telnyx messaging env).</p>
          </div>
          <Switch
            checked={aiIntake.smsNotify}
            onCheckedChange={(v) => setAiIntake((p) => ({ ...p, smsNotify: v }))}
            aria-label="SMS lead notifications"
          />
        </div>
      </section>

      {variant === "modal" ? (
        <div className="border-t border-border pt-3">
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
      ) : null}
    </>
  )

  if (variant === "page") {
    return (
      <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-28">
        {inner}
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

  return <div className="space-y-4">{inner}</div>
}
