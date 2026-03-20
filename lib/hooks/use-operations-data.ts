"use client"

import { useEffect, useState } from "react"

export type UiCallType = "incoming" | "outgoing" | "missed" | "voicemail"

export interface UiCallRecord {
  id: string
  type: UiCallType
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

export interface VoiceQualitySummary {
  total_calls: number
  answered_calls: number
  answer_rate_percent: number
  avg_setup_ms: number | null
  p95_setup_ms: number | null
  avg_post_dial_delay_ms: number | null
}

export interface VoiceOperationsInsights {
  daily_quality: {
    day: string
    total_calls: number
    answered_calls: number
    answer_rate_percent: number
    avg_setup_ms: number | null
  }[]
  number_quality: {
    number: string
    total_calls: number
    answered_calls: number
    answer_rate_percent: number
    avg_setup_ms: number | null
  }[]
  top_missed_callers: {
    caller_number: string
    missed_calls: number
    last_missed_at: string
  }[]
}

// --- In-memory cache (same browser tab) ---------------------------------------
// Activity remounts on every tab visit; without this we always set loading=true
// and flash the full-page skeleton until /api/calls + /api/voice/quality return.
const CACHE_TTL_MS = 45_000

type OperationsCache = {
  calls: UiCallRecord[]
  quality: VoiceQualitySummary | null
  insights: VoiceOperationsInsights | null
  fetchedAt: number
}

let operationsCache: OperationsCache | null = null

function cacheIsFresh(c: OperationsCache) {
  return Date.now() - c.fetchedAt < CACHE_TTL_MS
}

/** Clears cached calls/quality (e.g. after sign-out) so another account never sees stale rows. */
export function clearOperationsDataCache() {
  operationsCache = null
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

function normalizeCallType(value: unknown): UiCallType {
  const t = String(value || "incoming")
  if (t === "incoming" || t === "outgoing" || t === "missed" || t === "voicemail") return t
  return "incoming"
}

export function useOperationsData() {
  const seed = operationsCache
  const [calls, setCalls] = useState<UiCallRecord[]>(() => seed?.calls ?? [])
  const [quality, setQuality] = useState<VoiceQualitySummary | null>(() => seed?.quality ?? null)
  const [insights, setInsights] = useState<VoiceOperationsInsights | null>(() => seed?.insights ?? null)
  // Full-page skeleton only when we have never loaded successfully in this tab.
  const [loading, setLoading] = useState(() => operationsCache === null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadData() {
      const cached = operationsCache
      if (cached && cacheIsFresh(cached)) {
        if (!mounted) return
        setCalls(cached.calls)
        setQuality(cached.quality)
        setInsights(cached.insights)
        setLoading(false)
        setLoadError(null)
        return
      }

      if (!cached) {
        setLoading(true)
        setLoadError(null)
      } else {
        setRefreshing(true)
      }

      try {
        const [callsRes, qualityRes] = await Promise.all([
          fetch("/api/calls?limit=100", { credentials: "include" }),
          fetch("/api/voice/quality?days=7", { credentials: "include" }),
        ])

        if (!callsRes.ok) throw new Error("Failed to load calls")
        const callsData = await callsRes.json()
        const normalizedCalls: UiCallRecord[] = Array.isArray(callsData.calls)
          ? callsData.calls.map((c: Record<string, unknown>) => {
            const createdAtRaw = String(c.created_at || "")
            const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date()
            const routedTo = String(c.routed_to_name || c.routed_to_receptionist_id || "Owner")
            return {
              id: String(c.id || c.provider_call_sid || c.twilio_call_sid || crypto.randomUUID()),
              type: normalizeCallType(c.call_type),
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
        let qualityInsights: VoiceOperationsInsights | null = null
        if (qualityRes.ok) {
          const q = await qualityRes.json()
          if (q?.summary) qualitySummary = q.summary as VoiceQualitySummary
          if (q?.insights) qualityInsights = q.insights as VoiceOperationsInsights
        }

        if (!mounted) return
        setCalls(normalizedCalls)
        setQuality(qualitySummary)
        setInsights(qualityInsights)
        operationsCache = {
          calls: normalizedCalls,
          quality: qualitySummary,
          insights: qualityInsights,
          fetchedAt: Date.now(),
        }
        setLoadError(null)
      } catch (e) {
        if (!mounted) return
        if (!operationsCache) {
          setLoadError(e instanceof Error ? e.message : "Failed to load operations data")
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [])

  return { calls, quality, insights, loading, loadError, refreshing }
}
