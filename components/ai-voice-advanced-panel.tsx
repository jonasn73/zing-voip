"use client"

// ============================================
// Voice / Vapi “advanced” controls (single home)
// ============================================
// Lives on AI call flow only — keeps Settings free of duplicate AI UI.
// Activation uses the banner on the same page (POST with intake); this panel only PATCHes voice/limits once active.

import { useEffect, useRef, useState } from "react"
import { Bot, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { IconSurface } from "@/components/ui/icon-surface"
import { AI_VOICE_FALLBACK_OPTIONS, type AiVoiceOption } from "@/lib/ai-voice-catalog"

interface AiAssistantConfig {
  firstMessage: string
  voiceId: string
  temperature: number
  endCallMessage: string
  maxDurationSeconds: number
  silenceTimeoutSeconds: number
  businessHours: string
  customInstructions: string
}

function extractBusinessHoursFromPrompt(prompt: string): string {
  const marker = "2. SHARE BUSINESS HOURS:"
  const idx = prompt.indexOf(marker)
  if (idx === -1) return ""
  const rest = prompt.slice(idx + marker.length).trim()
  const endIdx = rest.indexOf("\n")
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).trim()
}

/** assistantActive = parent already created Vapi assistant (banner Activate). */
export function AiVoiceAdvancedPanel({ assistantActive }: { assistantActive: boolean }) {
  const { toast } = useToast()
  const [userName, setUserName] = useState("My Business")
  const [aiAssistantId, setAiAssistantId] = useState<string | null>(null)
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSavedAt, setAiSavedAt] = useState<number | null>(null)
  const [customVoiceIdOverride, setCustomVoiceIdOverride] = useState("")
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false)
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [aiVoiceOptions, setAiVoiceOptions] = useState<AiVoiceOption[]>(AI_VOICE_FALLBACK_OPTIONS)
  const [aiVoicesReady, setAiVoicesReady] = useState(false)
  const [aiConfig, setAiConfig] = useState<AiAssistantConfig>({
    firstMessage: "",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    temperature: 0.7,
    endCallMessage: "Thank you for calling. Have a great day!",
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
    businessHours: "Monday through Friday, 9 AM to 5 PM. Closed weekends.",
    customInstructions: "",
  })

  const previewVoiceId = customVoiceIdOverride.trim() || aiConfig.voiceId
  const previewVoiceLabel =
    aiVoiceOptions.find((voice) => voice.id === previewVoiceId)?.label ||
    (customVoiceIdOverride.trim() ? "Custom voice" : "Selected voice")

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.data?.user) {
          const u = data.data.user
          setUserName(String(u.name || u.email || "My Business"))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-assistant/voices", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.voices || !Array.isArray(data.voices)) return
        setAiVoiceOptions(data.voices as AiVoiceOption[])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAiVoicesReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!aiVoicesReady || aiConfigLoading) return
    const v = aiConfig.voiceId
    if (!v || !aiVoiceOptions.some((o) => o.id === v)) return
    setCustomVoiceIdOverride((prev) => (prev === v ? "" : prev))
  }, [aiVoicesReady, aiVoiceOptions, aiConfig.voiceId, aiConfigLoading])

  useEffect(() => {
    let cancelled = false
    setAiConfigLoading(true)
    fetch("/api/ai-assistant", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setAiAssistantId(data.assistantId || null)
        const config = data.assistantConfig as Record<string, unknown> | null
        if (config) {
          const systemPrompt = String(config.systemPrompt || "")
          setAiConfig((prev) => ({
            ...prev,
            firstMessage: String(config.firstMessage || prev.firstMessage),
            voiceId: String(config.voiceId || prev.voiceId),
            temperature:
              typeof config.temperature === "number" ? Number(config.temperature) : prev.temperature,
            endCallMessage: String(config.endCallMessage || prev.endCallMessage),
            maxDurationSeconds:
              typeof config.maxDurationSeconds === "number"
                ? Number(config.maxDurationSeconds)
                : prev.maxDurationSeconds,
            silenceTimeoutSeconds:
              typeof config.silenceTimeoutSeconds === "number"
                ? Number(config.silenceTimeoutSeconds)
                : prev.silenceTimeoutSeconds,
            businessHours: extractBusinessHoursFromPrompt(systemPrompt) || prev.businessHours,
          }))
          const loadedVoiceId = String(config.voiceId || "")
          if (loadedVoiceId && !AI_VOICE_FALLBACK_OPTIONS.some((x) => x.id === loadedVoiceId)) {
            setCustomVoiceIdOverride(loadedVoiceId)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAiConfigLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function stopVoicePreview() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setVoicePreviewPlaying(false)
  }

  useEffect(() => {
    return () => stopVoicePreview()
  }, [])

  async function handleSaveAiAssistant() {
    if (!assistantActive) return
    setAiSaving(true)
    try {
      const resolvedVoiceId = customVoiceIdOverride.trim() || aiConfig.voiceId
      const res = await fetch("/api/ai-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greeting: aiConfig.firstMessage,
          businessName: userName,
          voiceId: resolvedVoiceId,
          temperature: aiConfig.temperature,
          businessHours: aiConfig.businessHours,
          customInstructions: aiConfig.customInstructions,
          endCallMessage: aiConfig.endCallMessage,
          maxDurationSeconds: aiConfig.maxDurationSeconds,
          silenceTimeoutSeconds: aiConfig.silenceTimeoutSeconds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "AI update failed",
          description: data.error || "Could not save assistant changes.",
          variant: "destructive",
        })
        return
      }
      setAiSavedAt(Date.now())
      toast({
        title: "Voice settings saved",
        description: "Live calls will use this voice and phrasing on the next assistant update.",
      })
    } finally {
      setAiSaving(false)
    }
  }

  async function previewSelectedVoice() {
    const voiceId = customVoiceIdOverride.trim() || aiConfig.voiceId
    const text =
      aiConfig.firstMessage?.trim() ||
      "Hello! Thanks for calling. I can help with appointments, messages, and business information."
    if (!voiceId) {
      toast({
        title: "Voice required",
        description: "Select or enter a voice before previewing.",
        variant: "destructive",
      })
      return
    }

    stopVoicePreview()
    setVoicePreviewLoading(true)
    try {
      const res = await fetch("/api/ai-assistant/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voiceId, text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = String(data.error || "").toLowerCase()
        const isPlanLimit =
          err.includes("library") ||
          err.includes("subscription") ||
          err.includes("free users") ||
          err.includes("upgrade")
        toast({
          title: isPlanLimit ? "Preview limited" : "Preview unavailable",
          description: isPlanLimit
            ? "Live calls still use your saved assistant. Preview needs a supported speech plan for this voice, or try another voice in the list."
            : data.error || "Try another voice or save and test on a quick call.",
          variant: "destructive",
        })
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const audio = new Audio(objectUrl)
      previewAudioRef.current = audio
      audio.onended = () => {
        setVoicePreviewPlaying(false)
        URL.revokeObjectURL(objectUrl)
      }
      audio.onpause = () => setVoicePreviewPlaying(false)
      setVoicePreviewPlaying(true)
      void audio.play().catch(() => {
        setVoicePreviewPlaying(false)
        URL.revokeObjectURL(objectUrl)
        toast({
          title: "Preview blocked",
          description: "Tap Preview again if your browser blocked playback.",
          variant: "destructive",
        })
      })
    } catch {
      toast({
        title: "Preview failed",
        description: "Could not generate preview. Try again.",
        variant: "destructive",
      })
    } finally {
      setVoicePreviewLoading(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconSurface tone="primary" className="h-9 w-9">
            <Bot className="h-4 w-4" />
          </IconSurface>
          <div>
            <p className="text-xs font-semibold text-foreground">Voice &amp; call limits</p>
            <p className="text-[10px] text-muted-foreground">Optional — tune how the assistant sounds on the phone.</p>
          </div>
        </div>
        {assistantActive ? (
          <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
            Active
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            Not active
          </span>
        )}
      </div>

      {aiConfigLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voice settings…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/25 p-3">
            {!assistantActive ? (
              <p className="text-[10px] text-muted-foreground">
                Use <span className="font-medium text-foreground">Activate voice assistant</span> in the banner above
                first. Then save playbook with <span className="font-medium text-foreground">Save call flow</span>, and
                use <span className="font-medium text-foreground">Save voice changes</span> here for voice and limits.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                After editing voice or limits, tap <span className="font-medium text-foreground">Save voice changes</span>.
                Playbook and opening line use <span className="font-medium text-foreground">Save call flow</span> below.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSaveAiAssistant()}
                disabled={aiSaving || !assistantActive}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save voice changes
              </button>
              {aiSavedAt != null && (
                <span className="text-[10px] text-success">Saved just now</span>
              )}
            </div>
          </div>

          <details className="rounded-xl border border-border/70 bg-secondary/20 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-foreground">Voice, greeting &amp; limits</summary>
            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Voice &amp; tone</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">Voice</label>
                    <p className="text-[10px] text-muted-foreground">
                      Curated for live calls. Preview may depend on your speech plan.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={aiConfig.voiceId}
                        onChange={(e) => setAiConfig((prev) => ({ ...prev, voiceId: e.target.value }))}
                        className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        {aiVoiceOptions.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void previewSelectedVoice()}
                          disabled={voicePreviewLoading}
                          className="rounded-lg border border-border/70 px-3 py-2 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {voicePreviewLoading ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Preview…
                            </span>
                          ) : (
                            "Preview"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={stopVoicePreview}
                          disabled={!voicePreviewPlaying && !voicePreviewLoading}
                          className="rounded-lg border border-border/70 px-3 py-2 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          {voicePreviewPlaying ? `Stop (${previewVoiceLabel})` : "Stop"}
                        </button>
                      </div>
                    </div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Advanced (optional)</label>
                    <input
                      type="text"
                      value={customVoiceIdOverride}
                      onChange={(e) => setCustomVoiceIdOverride(e.target.value)}
                      placeholder="Custom voice ID from your provider"
                      className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Tone ({aiConfig.temperature.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={aiConfig.temperature}
                      onChange={(e) =>
                        setAiConfig((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assistant lines</p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">First greeting (Vapi)</label>
                  <textarea
                    value={aiConfig.firstMessage}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, firstMessage: e.target.value }))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                    placeholder="Thanks for calling. How can I help?"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    “What callers hear first” above syncs routing; this field updates the live assistant when you save.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Business hours text</label>
                  <input
                    type="text"
                    value={aiConfig.businessHours}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, businessHours: e.target.value }))}
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                    placeholder="Mon–Fri 9–5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Custom instructions (optional)</label>
                  <textarea
                    value={aiConfig.customInstructions}
                    onChange={(e) =>
                      setAiConfig((prev) => ({ ...prev, customInstructions: e.target.value }))
                    }
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Goodbye message</label>
                  <input
                    type="text"
                    value={aiConfig.endCallMessage}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, endCallMessage: e.target.value }))}
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Call limits</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Silence timeout (sec)</label>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={aiConfig.silenceTimeoutSeconds}
                      onChange={(e) =>
                        setAiConfig((prev) => ({
                          ...prev,
                          silenceTimeoutSeconds: Number(e.target.value || 30),
                        }))
                      }
                      className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Max length (sec)</label>
                    <input
                      type="number"
                      min={60}
                      max={1200}
                      value={aiConfig.maxDurationSeconds}
                      onChange={(e) =>
                        setAiConfig((prev) => ({
                          ...prev,
                          maxDurationSeconds: Number(e.target.value || 300),
                        }))
                      }
                      className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>

          {aiAssistantId ? (
            <details className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-[10px] text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Technical reference</summary>
              <p className="mt-2 break-all">Assistant ID: {aiAssistantId}</p>
            </details>
          ) : null}
        </div>
      )}
    </section>
  )
}
