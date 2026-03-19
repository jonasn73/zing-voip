"use client"

import { useState, useEffect, useRef } from "react"
import {
  Moon,
  Bell,
  Clock,
  Voicemail,
  Shield,
  ChevronRight,
  User,
  LogOut,
  HelpCircle,
  MessageSquare,
  Volume2,
  Phone,
  PhoneForwarded,
  ArrowRightLeft,
  Bot,
  Sparkles,
  Plus,
  Hash,
  X,
  Check,
  Loader2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { IconSurface } from "@/components/ui/icon-surface"

interface SettingToggle {
  id: string
  label: string
  description: string
  icon: typeof Moon
  enabled: boolean
  iconColor: string
}

// Receptionist fetched from /api/receptionists
interface ReceptionistInfo {
  id: string
  name: string
  phone: string
  initials: string
  color: string
}

// Per-number routing config fetched from /api/routing?all=true
interface NumberRouting {
  business_number: string | null
  selected_receptionist_id: string | null
}

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

const AI_VOICE_OPTIONS: { id: string; label: string }[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel - Warm & Professional" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi - Confident Female" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella - Friendly Female" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni - Calm Male" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam - Conversational Male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh - Balanced Male" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel - Deep Male" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte - Polished Female" },
]

interface CustomAiPreset {
  id: string
  label: string
  config: AiAssistantConfig
}

type AiPresetId =
  | "general"
  | "dental"
  | "legal"
  | "real_estate"
  | "home_services"
  | "med_spa"

const AI_PRESETS: Record<
  AiPresetId,
  { label: string; config: Partial<AiAssistantConfig> }
> = {
  general: {
    label: "General Small Business",
    config: {
      firstMessage: "Thank you for calling. Our team is helping other customers right now, but I can help you quickly. How can I assist you today?",
      temperature: 0.6,
      businessHours: "Monday through Friday, 9 AM to 5 PM. Closed weekends.",
      customInstructions:
        "Prioritize message-taking and clear callback details. Keep responses concise and friendly.",
    },
  },
  dental: {
    label: "Dental Practice",
    config: {
      firstMessage: "Thank you for calling our dental office. I can help with appointments, insurance questions, or a message for the front desk. How can I help?",
      temperature: 0.5,
      businessHours: "Monday through Friday, 8 AM to 5 PM. Closed weekends.",
      customInstructions:
        "If caller has pain or urgent issue, mark as urgent and collect callback number immediately. For appointments, collect preferred date and time.",
    },
  },
  legal: {
    label: "Law Firm",
    config: {
      firstMessage: "Thank you for calling our law office. I can take your information and have the right team member return your call as soon as possible.",
      temperature: 0.4,
      businessHours: "Monday through Friday, 8:30 AM to 5:30 PM. Closed weekends.",
      customInstructions:
        "Stay professional and avoid legal advice. Collect case type, full name, best callback number, and urgency.",
    },
  },
  real_estate: {
    label: "Real Estate Team",
    config: {
      firstMessage: "Thanks for calling our real estate team. I can help with showing requests, listing questions, or connect your message to an agent.",
      temperature: 0.7,
      businessHours: "Monday through Saturday, 9 AM to 6 PM. Sunday by appointment.",
      customInstructions:
        "For buyer leads, ask location, budget range, and timeline. For seller leads, ask property address and best callback number.",
    },
  },
  home_services: {
    label: "Home Services",
    config: {
      firstMessage: "Thank you for calling. I can help schedule service, provide availability windows, or take a message for the dispatch team.",
      temperature: 0.6,
      businessHours: "Monday through Friday, 7 AM to 6 PM. Saturday 8 AM to 2 PM.",
      customInstructions:
        "Collect service address, service type, urgency, and callback number. If emergency issue, mark urgent.",
    },
  },
  med_spa: {
    label: "Med Spa / Aesthetics",
    config: {
      firstMessage: "Thank you for calling our med spa. I can help with treatment questions, availability, or booking a consultation.",
      temperature: 0.65,
      businessHours: "Tuesday through Saturday, 10 AM to 7 PM.",
      customInstructions:
        "For new clients, collect treatment interest and preferred appointment window. Keep tone warm, polished, and reassuring.",
    },
  },
}

// Format E.164 phone for display, e.g. +15551234567 -> (555) 123-4567. Safe for null/undefined or non-string (e.g. from API).
function formatPhoneDisplay(phone: string | undefined | null): string {
  if (phone == null || typeof phone !== "string") return "your cell"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

function extractBusinessHoursFromPrompt(prompt: string): string {
  const marker = "2. SHARE BUSINESS HOURS:"
  const idx = prompt.indexOf(marker)
  if (idx === -1) return ""
  const rest = prompt.slice(idx + marker.length).trim()
  const endIdx = rest.indexOf("\n")
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).trim()
}

export function SettingsPage() {
  const { toast } = useToast()
  const [user, setUser] = useState<{ name: string; email: string; phone: string } | null>(null)
  const [settings, setSettings] = useState<SettingToggle[]>([
    {
      id: "dnd",
      label: "Do Not Disturb",
      description: "Silence all notifications",
      icon: Moon,
      enabled: false,
      iconColor: "text-chart-3",
    },
    {
      id: "voicemail",
      label: "Voicemail Fallback",
      description: "Send to voicemail when no answer",
      icon: Voicemail,
      enabled: true,
      iconColor: "text-primary",
    },
    {
      id: "notifications",
      label: "Push Notifications",
      description: "Get notified of routing changes",
      icon: Bell,
      enabled: true,
      iconColor: "text-warning",
    },
    {
      id: "ring-all",
      label: "Ring All Simultaneously",
      description: "Ring all active contacts at once",
      icon: Volume2,
      enabled: false,
      iconColor: "text-chart-5",
    },
    {
      id: "sms-forward",
      label: "SMS Forwarding",
      description: "Forward texts to active contacts",
      icon: MessageSquare,
      enabled: true,
      iconColor: "text-chart-2",
    },
  ])

  const [showNumberModal, setShowNumberModal] = useState(false)
  const [numberTab, setNumberTab] = useState<"buy" | "port">("buy")
  const [portNumber, setPortNumber] = useState("")
  const [portCarrier, setPortCarrier] = useState("")
  const [portSubmitted, setPortSubmitted] = useState(false)
  const [portSubmitMessage, setPortSubmitMessage] = useState("")
  const [selectedAreaCode, setSelectedAreaCode] = useState("")
  const [buyStep, setBuyStep] = useState<"search" | "results">("search")
  const [buyLoading, setBuyLoading] = useState(false)
  const [portingNumbers, setPortingNumbers] = useState<{ id: string; number: string; status: string; statusLabel?: string }[]>([])
  const [portingLoading, setPortingLoading] = useState(false)
  const [portSubmitLoading, setPortSubmitLoading] = useState(false)
  const [portError, setPortError] = useState<string | null>(null)
  // Port multi-step: 1 = number, 2 = account info, 3 = address
  const [portStep, setPortStep] = useState(1)
  const [portAccountName, setPortAccountName] = useState("")
  const [portAuthPerson, setPortAuthPerson] = useState("")
  const [portAccountNumber, setPortAccountNumber] = useState("")
  const [portPin, setPortPin] = useState("")
  const [portStreet, setPortStreet] = useState("")
  const [portCity, setPortCity] = useState("")
  const [portState, setPortState] = useState("")
  const [portZip, setPortZip] = useState("")
  const [portInvoiceFile, setPortInvoiceFile] = useState<File | null>(null) // recent carrier bill (image or PDF)
  const [portInvoiceBase64, setPortInvoiceBase64] = useState<string | null>(null) // base64 data to send to API
  const [editingMainLine, setEditingMainLine] = useState(false)
  const [mainLineEdit, setMainLineEdit] = useState("")
  const [mainLineSaveLoading, setMainLineSaveLoading] = useState(false)
  const [mainLineError, setMainLineError] = useState<string | null>(null)
  const [mainLineSavedAt, setMainLineSavedAt] = useState<number | null>(null)

  // Per-number routing state
  const [receptionistsList, setReceptionistsList] = useState<ReceptionistInfo[]>([])
  const [numberRoutings, setNumberRoutings] = useState<NumberRouting[]>([])
  const [routingModalNumber, setRoutingModalNumber] = useState<string | null>(null) // E.164 number being configured, or null if closed
  const [routingSaving, setRoutingSaving] = useState(false)
  const [hasAiAssistant, setHasAiAssistant] = useState(false)
  const [aiAssistantId, setAiAssistantId] = useState<string | null>(null)
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSavedAt, setAiSavedAt] = useState<number | null>(null)
  const [aiPreset, setAiPreset] = useState<AiPresetId>("general")
  const [autoApplyPresetToLive, setAutoApplyPresetToLive] = useState(true)
  const [customAiPresets, setCustomAiPresets] = useState<CustomAiPreset[]>([])
  const [selectedCustomPresetId, setSelectedCustomPresetId] = useState<string>("")
  const [customPresetName, setCustomPresetName] = useState("")
  const [customVoiceIdOverride, setCustomVoiceIdOverride] = useState("")
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false)
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
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

  // Load current user so we can show main line (cell) in profile
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.data?.user) {
          setUser({
            name: data.data.user.name ?? "My Business",
            email: data.data.user.email ?? "",
            phone: data.data.user.phone ?? "",
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load saved custom AI presets from cloud API (shared across devices)
  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-assistant/presets", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { presets: [] }))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data.presets)) {
          setCustomAiPresets(
            data.presets.map((p: Record<string, unknown>) => ({
              id: String(p.id),
              label: String(p.label || "Preset"),
              config: (p.config as AiAssistantConfig) || {
                firstMessage: "",
                voiceId: "21m00Tcm4TlvDq8ikWAM",
                temperature: 0.7,
                endCallMessage: "Thank you for calling. Have a great day!",
                maxDurationSeconds: 300,
                silenceTimeoutSeconds: 30,
                businessHours: "Monday through Friday, 9 AM to 5 PM. Closed weekends.",
                customInstructions: "",
              },
            }))
          )
        }
      })
      .catch(() => {
        if (!cancelled) setCustomAiPresets([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load receptionists for per-number routing picker
  useEffect(() => {
    let cancelled = false
    fetch("/api/receptionists", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.data)) {
          setReceptionistsList(data.data.map((r: Record<string, string>) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            initials: r.initials || r.name?.slice(0, 2)?.toUpperCase() || "??",
            color: r.color || "bg-primary",
          })))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load all routing configs (default + per-number) so we can show which receptionist is assigned
  useEffect(() => {
    let cancelled = false
    fetch("/api/routing?all=true", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { configs: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.configs)) {
          setNumberRoutings(data.configs.map((c: Record<string, string | null>) => ({
            business_number: c.business_number,
            selected_receptionist_id: c.selected_receptionist_id,
          })))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load AI assistant status + existing config from Vapi
  useEffect(() => {
    let cancelled = false
    setAiConfigLoading(true)
    fetch("/api/ai-assistant", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setHasAiAssistant(Boolean(data.hasAssistant))
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
          if (loadedVoiceId && !AI_VOICE_OPTIONS.some((v) => v.id === loadedVoiceId)) {
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

  // Load porting orders so dashboard shows progress
  useEffect(() => {
    let cancelled = false
    setPortingLoading(true)
    fetch("/api/numbers/porting", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { porting: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.porting)) setPortingNumbers(data.porting)
      })
      .catch(() => { if (!cancelled) setPortingNumbers([]) })
      .finally(() => { if (!cancelled) setPortingLoading(false) })
    return () => { cancelled = true }
  }, [])

  const [availableNumbers, setAvailableNumbers] = useState<{ number: string; friendly: string; type: string; price: string }[]>([])
  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null) // number currently being purchased
  const [buySuccess, setBuySuccess] = useState<string | null>(null) // number just purchased

  // Business numbers = numbers customers call (bought or ported). Your main line (cell) is in the profile above.
  const [myNumbers, setMyNumbers] = useState<{ id: string; number: string; label: string; type: string; status: string }[]>([])

  // Load user's purchased/active business numbers from the database
  useEffect(() => {
    let cancelled = false
    fetch("/api/numbers/mine", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { numbers: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.numbers)) {
          setMyNumbers(data.numbers.map((n: Record<string, string>) => ({
            id: n.id,
            number: n.number,
            label: n.label || "Business Line",
            type: n.type || "local",
            status: n.status || "active",
          })))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Auto-configure any unconfigured numbers with Telnyx TeXML webhook (runs silently)
  useEffect(() => {
    fetch("/api/numbers/configure", { method: "POST", credentials: "include" }).catch(() => {})
  }, [])

  async function handleSearchNumbers() {
    setBuyLoading(true)
    setBuyError(null)
    setAvailableNumbers([])
    setBuySuccess(null)
    try {
      const res = await fetch(`/api/numbers/telnyx?area_code=${selectedAreaCode}&type=local`, { credentials: "include" })
      const data = await res.json()
      if (!res.ok) {
        setBuyError(data.error || "Search failed")
        return
      }
      const nums = (data.numbers || []).map((n: { number: string; friendly_name: string; type: string; monthly_cost: string | number }) => ({
        number: n.number,
        friendly: formatPhoneDisplay(n.number),
        type: n.type === "toll_free" ? "Toll-Free" : "Local",
        price: `$${parseFloat(String(n.monthly_cost || "1")).toFixed(2)}/mo`,
      }))
      setAvailableNumbers(nums)
      if (nums.length === 0) setBuyError("No numbers found for this area code. Try another.")
      setBuyStep("results")
    } catch {
      setBuyError("Search failed. Try again.")
    } finally {
      setBuyLoading(false)
    }
  }

  async function handleBuyNumber(phoneNumber: string) {
    setBuyingNumber(phoneNumber)
    setBuyError(null)
    try {
      const res = await fetch("/api/numbers/telnyx/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone_number: phoneNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBuyError(data.error || "Failed to buy number")
        return
      }
      setBuySuccess(phoneNumber)
      toast({
        title: "Number purchased",
        description: `${formatPhoneDisplay(phoneNumber)} is ready to receive calls.`,
      })
      setAvailableNumbers((prev) => prev.filter((n) => n.number !== phoneNumber))
      // Add the newly purchased number to the displayed list right away
      setMyNumbers((prev) => [...prev, {
        id: data.number?.id || phoneNumber,
        number: phoneNumber,
        label: "Business Line",
        type: "local",
        status: "active",
      }])
    } catch {
      setBuyError("Failed to buy number. Try again.")
    } finally {
      setBuyingNumber(null)
    }
  }

  async function handlePortSubmit() {
    setPortError(null)
    setPortSubmitLoading(true)
    try {
      const res = await fetch("/api/numbers/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          number: portNumber,
          account_name: portAccountName,
          authorized_person: portAuthPerson,
          account_number: portAccountNumber || undefined,
          pin: portPin || undefined,
          street_address: portStreet,
          city: portCity,
          state: portState,
          zip: portZip,
          invoice_base64: portInvoiceBase64 || undefined,
          invoice_filename: portInvoiceFile?.name || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortError(data.error || "Failed to start port")
        return
      }
      setPortSubmitMessage(data.message || "Your number is being transferred to Zing.")
      setPortSubmitted(true)
      toast({
        title: "Port request submitted",
        description: "We started your transfer and will keep status updated here.",
      })
      const portingRes = await fetch("/api/numbers/porting", { credentials: "include" })
      const portingData = await portingRes.json()
      if (Array.isArray(portingData.porting)) setPortingNumbers(portingData.porting)
    } catch {
      setPortError("Failed to start port. Try again.")
    } finally {
      setPortSubmitLoading(false)
    }
  }

  // Convert a file to base64 string (for sending to our API)
  function handleInvoiceFile(file: File | null) {
    setPortInvoiceFile(file)
    if (!file) {
      setPortInvoiceBase64(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:... prefix so we have pure base64
      const base64 = result.includes(",") ? result.split(",")[1] : result
      setPortInvoiceBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  function resetPortForm() {
    setPortStep(1)
    setPortNumber("")
    setPortCarrier("")
    setPortAccountName("")
    setPortAuthPerson("")
    setPortAccountNumber("")
    setPortPin("")
    setPortStreet("")
    setPortCity("")
    setPortState("")
    setPortZip("")
    setPortInvoiceFile(null)
    setPortInvoiceBase64(null)
    setPortSubmitted(false)
    setPortSubmitMessage("")
    setPortError(null)
  }

  // Look up which receptionist is assigned to a specific business number
  function getRoutingForNumber(e164: string): { receptionist: ReceptionistInfo | null; isDefault: boolean } {
    const specific = numberRoutings.find((r) => r.business_number === e164)
    if (specific) {
      const rec = receptionistsList.find((r) => r.id === specific.selected_receptionist_id) || null
      return { receptionist: rec, isDefault: false }
    }
    // No specific config → uses default
    const defaultConfig = numberRoutings.find((r) => r.business_number === null)
    if (defaultConfig?.selected_receptionist_id) {
      const rec = receptionistsList.find((r) => r.id === defaultConfig.selected_receptionist_id) || null
      return { receptionist: rec, isDefault: true }
    }
    return { receptionist: null, isDefault: true }
  }

  // Save a receptionist assignment for a specific number
  async function saveNumberRouting(e164: string, receptionistId: string | null) {
    setRoutingSaving(true)
    try {
      const res = await fetch("/api/routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          business_number: e164,
          selected_receptionist_id: receptionistId,
        }),
      })
      if (res.ok) {
        // Update local state to reflect the change
        setNumberRoutings((prev) => {
          const existing = prev.find((r) => r.business_number === e164)
          if (existing) {
            return prev.map((r) =>
              r.business_number === e164 ? { ...r, selected_receptionist_id: receptionistId } : r
            )
          }
          return [...prev, { business_number: e164, selected_receptionist_id: receptionistId }]
        })
        setRoutingModalNumber(null)
        toast({
          title: "Routing saved",
          description: `${formatPhoneDisplay(e164)} was updated.`,
        })
      }
    } catch {
      // silently fail
    } finally {
      setRoutingSaving(false)
    }
  }

  function toggleSetting(id: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  async function handleActivateAiAssistant() {
    setAiSaving(true)
    try {
      const resolvedVoiceId = customVoiceIdOverride.trim() || aiConfig.voiceId
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greeting: aiConfig.firstMessage,
          businessName: user?.name || user?.email || "My Business",
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
          title: "AI setup failed",
          description: data.error || "Could not activate AI receptionist.",
          variant: "destructive",
        })
        return
      }
      setHasAiAssistant(true)
      setAiAssistantId(data.assistantId || null)
      setAiSavedAt(Date.now())
      toast({
        title: "AI receptionist activated",
        description: "Your AI receptionist is now ready for fallback calls.",
      })
    } finally {
      setAiSaving(false)
    }
  }

  async function maybeApplyToLive(config: AiAssistantConfig, sourceLabel: string) {
    if (!autoApplyPresetToLive || !hasAiAssistant) return
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greeting: config.firstMessage,
          businessName: user?.name || user?.email || "My Business",
          voiceId: customVoiceIdOverride.trim() || config.voiceId,
          temperature: config.temperature,
          businessHours: config.businessHours,
          customInstructions: config.customInstructions,
          endCallMessage: config.endCallMessage,
          maxDurationSeconds: config.maxDurationSeconds,
          silenceTimeoutSeconds: config.silenceTimeoutSeconds,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          title: "Live apply failed",
          description: data.error || "Preset loaded locally but could not update live assistant.",
          variant: "destructive",
        })
        return
      }
      setAiSavedAt(Date.now())
      toast({
        title: "Applied to live assistant",
        description: `${sourceLabel} is now active.`,
      })
    } catch {
      toast({
        title: "Live apply failed",
        description: "Preset loaded locally but could not update live assistant.",
        variant: "destructive",
      })
    }
  }

  function applyAiPreset(presetId: AiPresetId) {
    setAiPreset(presetId)
    const preset = AI_PRESETS[presetId]
    if (!preset) return
    const nextConfig = {
      ...aiConfig,
      ...preset.config,
    }
    setAiConfig(nextConfig)
    toast({
      title: "Preset applied",
      description: `${preset.label} template loaded. You can still edit everything.`,
    })
    void maybeApplyToLive(nextConfig, preset.label)
  }

  async function saveCurrentAsCustomPreset() {
    const label = customPresetName.trim()
    if (!label) {
      toast({
        title: "Preset name required",
        description: "Enter a name before saving your custom preset.",
        variant: "destructive",
      })
      return
    }
    try {
      const res = await fetch("/api/ai-assistant/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label,
          config: aiConfig,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: data.error || "Could not save custom preset.",
          variant: "destructive",
        })
        return
      }
      const created = data.preset as { id: string; label: string; config: AiAssistantConfig }
      const newPreset: CustomAiPreset = {
        id: String(created.id),
        label: String(created.label),
        config: created.config || { ...aiConfig },
      }
      setCustomAiPresets((prev) => [newPreset, ...prev].slice(0, 20))
      setCustomPresetName("")
      setSelectedCustomPresetId(newPreset.id)
      toast({
        title: "Custom preset saved",
        description: `${label} is now available in your preset list.`,
      })
    } catch {
      toast({
        title: "Save failed",
        description: "Could not save custom preset.",
        variant: "destructive",
      })
    }
  }

  function applyCustomPresetById(presetId: string) {
    const preset = customAiPresets.find((p) => p.id === presetId)
    if (!preset) return
    setSelectedCustomPresetId(preset.id)
    setAiConfig({ ...preset.config })
    toast({
      title: "Custom preset applied",
      description: `${preset.label} has been loaded.`,
    })
    void maybeApplyToLive({ ...preset.config }, preset.label)
  }

  async function deleteCustomPresetById(presetId: string) {
    const preset = customAiPresets.find((p) => p.id === presetId)
    if (!preset) return
    try {
      const res = await fetch(`/api/ai-assistant/presets?id=${encodeURIComponent(presetId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Delete failed",
          description: data.error || "Could not delete preset.",
          variant: "destructive",
        })
        return
      }
      setCustomAiPresets((prev) => prev.filter((p) => p.id !== presetId))
      if (selectedCustomPresetId === presetId) setSelectedCustomPresetId("")
      toast({
        title: "Custom preset removed",
        description: `${preset.label} was deleted.`,
      })
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete preset.",
        variant: "destructive",
      })
    }
  }

  async function renameSelectedCustomPreset() {
    if (!selectedCustomPresetId) return
    const current = customAiPresets.find((p) => p.id === selectedCustomPresetId)
    if (!current) return
    const nextLabel = window.prompt("Rename preset", current.label)?.trim()
    if (!nextLabel || nextLabel === current.label) return
    try {
      const res = await fetch("/api/ai-assistant/presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: current.id,
          label: nextLabel,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Rename failed",
          description: data.error || "Could not rename preset.",
          variant: "destructive",
        })
        return
      }
      setCustomAiPresets((prev) =>
        prev.map((p) => (p.id === current.id ? { ...p, label: nextLabel } : p))
      )
      toast({
        title: "Preset renamed",
        description: `Updated to "${nextLabel}".`,
      })
    } catch {
      toast({
        title: "Rename failed",
        description: "Could not rename preset.",
        variant: "destructive",
      })
    }
  }

  async function updateSelectedCustomPresetFromCurrent() {
    if (!selectedCustomPresetId) return
    const current = customAiPresets.find((p) => p.id === selectedCustomPresetId)
    if (!current) return
    try {
      const res = await fetch("/api/ai-assistant/presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: current.id,
          config: aiConfig,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Update failed",
          description: data.error || "Could not update preset.",
          variant: "destructive",
        })
        return
      }
      setCustomAiPresets((prev) =>
        prev.map((p) => (p.id === current.id ? { ...p, config: { ...aiConfig } } : p))
      )
      toast({
        title: "Preset updated",
        description: `${current.label} now matches your current AI settings.`,
      })
    } catch {
      toast({
        title: "Update failed",
        description: "Could not update preset.",
        variant: "destructive",
      })
    }
  }

  async function shareSelectedPresetCode() {
    if (!selectedCustomPresetId) return
    const current = customAiPresets.find((p) => p.id === selectedCustomPresetId)
    if (!current) return
    const payload = {
      version: 1,
      label: current.label,
      config: current.config,
    }
    try {
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      await navigator.clipboard.writeText(code)
      toast({
        title: "Share code copied",
        description: "Send this code to a teammate so they can import the preset.",
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy share code.",
        variant: "destructive",
      })
    }
  }

  async function importPresetFromCode() {
    const raw = window.prompt("Paste preset share code")
    if (!raw) return
    try {
      const json = decodeURIComponent(escape(atob(raw.trim())))
      const parsed = JSON.parse(json) as { label?: string; config?: AiAssistantConfig }
      const label = String(parsed.label || "Imported Preset").trim()
      const config = (parsed.config || aiConfig) as AiAssistantConfig
      const res = await fetch("/api/ai-assistant/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, config }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Import failed",
          description: data.error || "Could not import preset.",
          variant: "destructive",
        })
        return
      }
      const created = data.preset as { id: string; label: string; config: AiAssistantConfig }
      setCustomAiPresets((prev) => [{ id: created.id, label: created.label, config: created.config }, ...prev])
      setSelectedCustomPresetId(created.id)
      toast({
        title: "Preset imported",
        description: `${created.label} was added to your cloud presets.`,
      })
      void maybeApplyToLive(created.config, created.label)
    } catch {
      toast({
        title: "Import failed",
        description: "Invalid share code.",
        variant: "destructive",
      })
    }
  }

  async function handleSaveAiAssistant() {
    if (!hasAiAssistant) return
    setAiSaving(true)
    try {
      const resolvedVoiceId = customVoiceIdOverride.trim() || aiConfig.voiceId
      const res = await fetch("/api/ai-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greeting: aiConfig.firstMessage,
          businessName: user?.name || user?.email || "My Business",
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
        title: "AI receptionist updated",
        description: "Voice and behavior settings were saved.",
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
        toast({
          title: "High-quality preview unavailable",
          description: data.error || "Try Save, then place a quick test call for exact voice quality.",
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

  function startEditMainLine() {
    setMainLineError(null)
    setMainLineEdit(user?.phone ? formatPhoneDisplay(user.phone) : "")
    setEditingMainLine(true)
  }

  function cancelEditMainLine() {
    setEditingMainLine(false)
    setMainLineEdit("")
    setMainLineError(null)
  }

  async function saveMainLine() {
    if (!mainLineEdit.trim()) return
    setMainLineError(null)
    setMainLineSaveLoading(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: mainLineEdit.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMainLineError(data.error || "Failed to update")
        return
      }
      setEditingMainLine(false)
      setMainLineEdit("")
      // Refetch session so user state has the updated phone (E.164 from server)
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" })
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        if (sessionData?.data?.user) {
          setUser({
            name: sessionData.data.user.name ?? "My Business",
            email: sessionData.data.user.email ?? "",
            phone: sessionData.data.user.phone ?? "",
          })
          toast({
            title: "Main line updated",
            description: "Default destination number has been saved.",
          })
          setMainLineSavedAt(Date.now())
        }
      }
    } catch {
      setMainLineError("Something went wrong")
    } finally {
      setMainLineSaveLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-8">
      {/* Profile card: main line = owner's cell (default destination for calls) */}
      <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm transition-colors">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
            ME
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{user?.name ?? "My Business"}</p>
          <p className="text-sm text-muted-foreground">{user?.email || "owner@mybusiness.com"}</p>
          {editingMainLine ? (
            <div className="mt-2 space-y-2">
              <input
                type="tel"
                value={mainLineEdit}
                onChange={(e) => setMainLineEdit(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                autoFocus
              />
              {mainLineError && (
                <p className="text-xs text-destructive">{mainLineError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveMainLine}
                  disabled={mainLineSaveLoading || !mainLineEdit.trim()}
                  className="zing-btn-sm bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {mainLineSaveLoading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditMainLine}
                  disabled={mainLineSaveLoading}
                  className="zing-btn-sm border border-border/70 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {mainLineSavedAt && (
                <p className="text-[11px] text-success">Saved just now</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Main line: {formatPhoneDisplay(user?.phone)} — calls default here when no receptionist is selected.{" "}
              <button
                type="button"
                onClick={startEditMainLine}
                className="font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:no-underline"
              >
                Edit
              </button>
            </p>
          )}
          <Badge variant="secondary" className="mt-1 text-[10px]">
            Pro Plan
          </Badge>
        </div>
        {!editingMainLine && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>

      {/* Business numbers: the numbers customers call; buy or port; route to cell or receptionists */}
      <section className="space-y-3">
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Business numbers
          </h3>
          <p className="text-xs text-muted-foreground">
            Numbers your customers call (buy or port). Calls ring your main line or receptionist.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {myNumbers
            .filter((num) => num.status === "active")
            .map((num) => {
            const routing = getRoutingForNumber(num.number)
            return (
              <button
                key={num.number}
                onClick={() => setRoutingModalNumber(num.number)}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <IconSurface tone="primary">
                    <Phone className="h-4 w-4" />
                  </IconSurface>
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatPhoneDisplay(num.number)}</p>
                    <p className="text-xs text-muted-foreground">
                      {routing.receptionist
                        ? `→ ${routing.receptionist.name}${routing.isDefault ? " (default)" : ""}`
                        : `→ Your Phone${routing.isDefault ? " (default)" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    Active
                  </span>
                  <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}

          {portingLoading && portingNumbers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/85 py-6 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading port status…</span>
            </div>
          ) : null}
          {portingNumbers.map((p) => {
            const isComplete = p.status === "ported"
            const isError = p.status === "exception"
            const isCancelled = p.status === "cancelled" || p.status === "cancel-pending"
            const canCancel = !isComplete && p.status !== "in-process" && p.status !== "submitted" && p.status !== "port-activating"
            const badgeColor = isComplete ? "bg-success/10 text-success" : isError ? "bg-destructive/10 text-destructive" : isCancelled ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning"
            const iconBg = isComplete ? "bg-success/10" : isError ? "bg-destructive/10" : "bg-warning/10"
            const iconColor = isComplete ? "text-success" : isError ? "text-destructive" : "text-warning"
            // For completed ports, show routing info and make tappable
            const routing = isComplete ? getRoutingForNumber(p.number) : null
            const Wrapper = isComplete ? "button" as const : "div" as const
            return (
              <Wrapper
                key={p.id || p.number}
                {...(isComplete ? { onClick: () => setRoutingModalNumber(p.number) } : {})}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm",
                  isComplete && "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
                    {isComplete ? <Check className={cn("h-4 w-4", iconColor)} /> : <ArrowRightLeft className={cn("h-4 w-4", iconColor)} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatPhoneDisplay(p.number)}</p>
                    <p className="text-xs text-muted-foreground">
                      {isComplete && routing
                        ? routing.receptionist
                          ? `→ ${routing.receptionist.name}${routing.isDefault ? " (default)" : ""}`
                          : `→ Your Phone${routing.isDefault ? " (default)" : ""}`
                        : p.statusLabel || "Transfer in progress"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canCancel && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm(`Cancel porting for ${formatPhoneDisplay(p.number)}?`)) return
                        try {
                          const res = await fetch("/api/numbers/porting/cancel", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ order_id: p.id }),
                          })
                          if (res.ok) {
                            setPortingNumbers((prev) => prev.filter((x) => x.id !== p.id))
                          } else {
                            const data = await res.json().catch(() => ({}))
                            alert(data.error || "Failed to cancel")
                          }
                        } catch {
                          alert("Failed to cancel. Try again.")
                        }
                      }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
                    >
                      Cancel
                    </button>
                  )}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeColor)}>
                    {isComplete ? "Active" : isError ? "Action needed" : isCancelled ? "Cancelled" : "Porting"}
                  </span>
                  {isComplete && <PhoneForwarded className="h-4 w-4 text-muted-foreground" />}
                </div>
              </Wrapper>
            )
          })}

          <button
            onClick={() => { setShowNumberModal(true); setNumberTab("buy"); setBuyStep("search"); setSelectedAreaCode(""); resetPortForm() }}
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <IconSurface tone="primary">
                <Plus className="h-4 w-4" />
              </IconSurface>
              <div>
                <p className="text-sm font-medium text-primary">Add business number</p>
                <p className="text-xs text-muted-foreground">Buy new or port existing — calls route to your cell</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary/60" />
          </button>
        </div>
      </section>

      {/* Routing settings */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Call Routing
        </h3>
        <div className="flex flex-col gap-2">
          {settings.map((setting) => {
            const Icon = setting.icon
            return (
              <div
                key={setting.id}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm transition-colors"
              >
                <div className="flex items-center gap-3">
                  <IconSurface>
                    <Icon className={cn("h-4 w-4", setting.iconColor)} />
                  </IconSurface>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {setting.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {setting.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={() => toggleSetting(setting.id)}
                  aria-label={setting.label}
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* AI receptionist setup and customization */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            AI Receptionist
          </h3>
          {hasAiAssistant ? (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
              Not active
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
          {aiConfigLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading AI settings...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                <IconSurface tone="primary">
                  <Bot className="h-4 w-4" />
                </IconSurface>
                <div>
                  <p className="text-sm font-medium text-foreground">Voice Assistant Engine</p>
                  <p className="text-xs text-muted-foreground">
                    Customize voice, greeting, and call behavior for fallback calls.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Auto-apply presets to live assistant</p>
                  <p className="text-[11px] text-muted-foreground">
                    When on, applying/importing a preset immediately updates your live assistant.
                  </p>
                </div>
                <Switch
                  checked={autoApplyPresetToLive}
                  onCheckedChange={setAutoApplyPresetToLive}
                  aria-label="Auto apply presets to live assistant"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Business preset
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={aiPreset}
                    onChange={(e) => applyAiPreset(e.target.value as AiPresetId)}
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {Object.entries(AI_PRESETS).map(([id, preset]) => (
                      <option key={id} value={id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => applyAiPreset(aiPreset)}
                    type="button"
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Your custom presets
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCustomPresetId}
                    onChange={(e) => applyCustomPresetById(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">Select custom preset...</option>
                    {customAiPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedCustomPresetId}
                    onClick={() => deleteCustomPresetById(selectedCustomPresetId)}
                    className="zing-btn-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedCustomPresetId}
                    onClick={renameSelectedCustomPreset}
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={!selectedCustomPresetId}
                    onClick={updateSelectedCustomPresetFromCurrent}
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    Update from current
                  </button>
                  <button
                    type="button"
                    disabled={!selectedCustomPresetId}
                    onClick={shareSelectedPresetCode}
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    Copy share code
                  </button>
                  <button
                    type="button"
                    onClick={importPresetFromCode}
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted"
                  >
                    Import code
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    placeholder="Name this setup (e.g. Weekend Voice)"
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentAsCustomPreset}
                    className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted"
                  >
                    Save as preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground">Voice</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={aiConfig.voiceId}
                      onChange={(e) => setAiConfig((prev) => ({ ...prev, voiceId: e.target.value }))}
                      className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      {AI_VOICE_OPTIONS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={previewSelectedVoice}
                      disabled={voicePreviewLoading}
                      className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted"
                    >
                      {voicePreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={stopVoicePreview}
                      disabled={!voicePreviewPlaying && !voicePreviewLoading}
                      className="zing-btn-sm border border-border/70 text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Stop
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customVoiceIdOverride}
                    onChange={(e) => setCustomVoiceIdOverride(e.target.value)}
                    placeholder="Optional: paste any voice ID from your voice library"
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Want more voices? Paste any voice ID above to use your full voice library.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground">
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

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">First greeting</label>
                <textarea
                  value={aiConfig.firstMessage}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, firstMessage: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="Thanks for calling. How can I help?"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Business hours text</label>
                <input
                  type="text"
                  value={aiConfig.businessHours}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, businessHours: e.target.value }))}
                  className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="Mon-Fri 9am-5pm, closed weekends"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Custom instructions (optional)
                </label>
                <textarea
                  value={aiConfig.customInstructions}
                  onChange={(e) =>
                    setAiConfig((prev) => ({ ...prev, customInstructions: e.target.value }))
                  }
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="Example: prioritize collecting appointment requests and mention same-day callbacks."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground">Silence timeout (sec)</label>
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
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground">Max call length (sec)</label>
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
                    className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!hasAiAssistant ? (
                  <button
                    onClick={handleActivateAiAssistant}
                    disabled={aiSaving}
                    className="zing-btn-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Activate AI Receptionist
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAiAssistant}
                    disabled={aiSaving}
                    className="zing-btn-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save AI Settings
                  </button>
                )}
                {aiAssistantId && (
                  <span className="text-[11px] text-muted-foreground">Assistant ID: {aiAssistantId}</span>
                )}
              </div>
              {aiSavedAt && <p className="text-[11px] text-success">Saved just now</p>}
            </div>
          )}
        </div>
      </section>

      {/* Schedule */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule
        </h3>
        <button className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5">
          <div className="flex items-center gap-3">
            <IconSurface>
              <Clock className="h-4 w-4 text-primary" />
            </IconSurface>
            <div>
              <p className="text-sm font-medium text-foreground">
                Business Hours
              </p>
              <p className="text-xs text-muted-foreground">
                Mon-Fri, 9:00 AM - 5:00 PM
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </section>

      {/* Number Modal */}
      {showNumberModal && (
        <>
          <div
            className="fixed inset-0 z-40 animate-in fade-in-0 bg-background/60 backdrop-blur-sm duration-150"
            onClick={() => setShowNumberModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-4 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-card pb-3 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 [-webkit-overflow-scrolling:touch]">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Get a Number</h3>
              <button
                onClick={() => setShowNumberModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setNumberTab("buy")}
                className={cn(
                  "flex-1 py-2.5 text-center text-xs font-semibold transition-colors",
                  numberTab === "buy"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Buy New Number
              </button>
              <button
                onClick={() => setNumberTab("port")}
                className={cn(
                  "flex-1 py-2.5 text-center text-xs font-semibold transition-colors",
                  numberTab === "port"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Port Existing
              </button>
            </div>

            {/* Buy tab */}
            {numberTab === "buy" && (
              <div className="p-4">
                {buyStep === "search" ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">Search by area code to find available numbers.</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Area code (e.g. 305)"
                          maxLength={3}
                          value={selectedAreaCode}
                          onChange={(e) => setSelectedAreaCode(e.target.value.replace(/\D/g, ""))}
                          className="w-full rounded-xl border border-border/70 bg-secondary py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSearchNumbers}
                        disabled={selectedAreaCode.length < 3}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                      >
                        {buyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {availableNumbers.length} number{availableNumbers.length !== 1 ? "s" : ""} in ({selectedAreaCode})
                      </p>
                      <button
                        onClick={() => { setBuyStep("search"); setAvailableNumbers([]); setBuyError(null); setBuySuccess(null) }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Change
                      </button>
                    </div>

                    {buySuccess && (
                      <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3">
                        <Check className="h-4 w-4 text-success" />
                        <p className="text-xs font-medium text-success">
                          {formatPhoneDisplay(buySuccess)} purchased! It will appear in your business numbers shortly.
                        </p>
                      </div>
                    )}

                    {buyError && <p className="text-xs text-destructive">{buyError}</p>}

                    <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
                      {availableNumbers.map((num) => (
                        <button
                          key={num.number}
                          onClick={() => handleBuyNumber(num.number)}
                          disabled={buyingNumber !== null}
                          className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{num.friendly}</p>
                            <p className="text-[11px] text-muted-foreground">{num.type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{num.price}</span>
                            <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              {buyingNumber === num.number ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Buy"
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {availableNumbers.length === 0 && !buyError && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Port tab - multi-step */}
            {numberTab === "port" && (
              <div className="p-4">
                {portSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <Check className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Port Request Submitted</p>
                      <p className="mt-1 text-xs text-muted-foreground">{portSubmitMessage}</p>
                    </div>
                    <button
                      onClick={() => { setShowNumberModal(false); resetPortForm() }}
                      className="mt-2 rounded-xl bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 pb-1">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", s <= portStep ? "bg-primary" : "bg-border")} />
                      ))}
                    </div>

                    {/* Step 1: Phone number */}
                    {portStep === 1 && (
                      <>
                        <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3">
                          <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Port your existing business number to Zing. No downtime, no missed calls.
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Phone number to port</label>
                          <input
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={portNumber}
                            onChange={(e) => setPortNumber(e.target.value)}
                            className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                            autoFocus
                          />
                        </div>
                        {portError && <p className="text-xs text-destructive">{portError}</p>}
                        <button
                          onClick={() => { setPortError(null); setPortStep(2) }}
                          disabled={!portNumber.replace(/\D/g, "").length}
                          className="zing-btn-sm mt-1 w-full bg-primary py-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                        >
                          Next: Account info
                        </button>
                      </>
                    )}

                    {/* Step 2: Account information */}
                    {portStep === 2 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Enter the account details from your current phone provider. This authorizes the transfer.
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Name on account</label>
                          <input type="text" placeholder="Your name or business name" value={portAccountName} onChange={(e) => setPortAccountName(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" autoFocus />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Authorized person (who can approve the transfer)</label>
                          <input type="text" placeholder="Your full name" value={portAuthPerson} onChange={(e) => setPortAuthPerson(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Account number (optional)</label>
                          <input type="text" placeholder="From your current provider's bill" value={portAccountNumber} onChange={(e) => setPortAccountNumber(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Account PIN (optional)</label>
                          <input type="text" placeholder="If your carrier requires a PIN" value={portPin} onChange={(e) => setPortPin(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Recent carrier bill / invoice</label>
                          <p className="text-[10px] text-muted-foreground -mt-1">Upload a photo or PDF of your most recent phone bill. Required by carriers to verify the transfer.</p>
                          <label className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm transition-colors",
                            portInvoiceFile
                              ? "border-primary/40 bg-primary/5 text-primary"
                              : "border-border bg-secondary text-muted-foreground hover:border-primary/30 hover:bg-primary/5"
                          )}>
                            {portInvoiceFile ? (
                              <>
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                                <span className="truncate text-xs font-medium">{portInvoiceFile.name}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); handleInvoiceFile(null) }}
                                  className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-primary/10"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="text-xs">Tap to upload bill</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => handleInvoiceFile(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setPortStep(1)} className="flex-1 rounded-xl border border-border/70 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">Back</button>
                          <button onClick={() => setPortStep(3)} disabled={!portAccountName || !portAuthPerson || !portInvoiceFile} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">Next: Address</button>
                        </div>
                      </>
                    )}

                    {/* Step 3: Service address + submit */}
                    {portStep === 3 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Enter the address on file with your current carrier. This must match their records for the transfer to go through.
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Street address</label>
                          <input type="text" placeholder="123 Main St" value={portStreet} onChange={(e) => setPortStreet(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" autoFocus />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">City</label>
                            <input type="text" placeholder="City" value={portCity} onChange={(e) => setPortCity(e.target.value)} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">State</label>
                            <input type="text" placeholder="KY" maxLength={2} value={portState} onChange={(e) => setPortState(e.target.value.toUpperCase())} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">ZIP</label>
                            <input type="text" placeholder="40000" maxLength={5} value={portZip} onChange={(e) => setPortZip(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border border-border/70 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        {portError && <p className="text-xs text-destructive">{portError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => setPortStep(2)} disabled={portSubmitLoading} className="flex-1 rounded-xl border border-border/70 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50">Back</button>
                          <button onClick={handlePortSubmit} disabled={!portStreet || !portCity || !portState || !portZip || portSubmitLoading} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
                            {portSubmitLoading ? (<><Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Submitting...</>) : "Submit port request"}
                          </button>
                        </div>
                        <p className="text-center text-[10px] text-muted-foreground">
                          By submitting, you authorize the transfer of this number to Zing.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Per-number routing picker modal */}
      {routingModalNumber && (
        <>
          <div
            className="fixed inset-0 z-40 animate-in fade-in-0 bg-background/60 backdrop-blur-sm duration-150"
            onClick={() => setRoutingModalNumber(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-4 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-card pb-3 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 [-webkit-overflow-scrolling:touch]">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Route Calls</h3>
                <p className="text-xs text-muted-foreground">{formatPhoneDisplay(routingModalNumber)}</p>
              </div>
              <button
                onClick={() => setRoutingModalNumber(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col py-1" role="listbox" aria-label="Select who receives calls for this number">
              {/* Option: Your Phone (owner) */}
              {(() => {
                const currentRouting = getRoutingForNumber(routingModalNumber)
                const isOwnerSelected = !currentRouting.receptionist && !currentRouting.isDefault
                const isOwnerDefault = !currentRouting.receptionist && currentRouting.isDefault
                return (
                  <button
                    onClick={() => saveNumberRouting(routingModalNumber, null)}
                    disabled={routingSaving}
                    role="option"
                    aria-selected={isOwnerSelected}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50",
                      isOwnerSelected || isOwnerDefault ? "bg-secondary/50" : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      isOwnerSelected || isOwnerDefault ? "bg-foreground/15" : "bg-muted-foreground/15"
                    )}>
                      <User className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight text-foreground">Your Phone</p>
                      <p className="text-[11px] text-muted-foreground">{formatPhoneDisplay(user?.phone)} (owner)</p>
                    </div>
                    {(isOwnerSelected || isOwnerDefault) && (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                        {isOwnerDefault ? "Default" : "Selected"}
                      </span>
                    )}
                  </button>
                )
              })()}

              {receptionistsList.length > 0 && (
                <>
                  <div className="mx-4 border-b border-border" />
                  <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Receptionists
                  </p>
                </>
              )}

              {receptionistsList.map((rec) => {
                const currentRouting = getRoutingForNumber(routingModalNumber)
                const isSelected = currentRouting.receptionist?.id === rec.id
                return (
                  <button
                    key={rec.id}
                    onClick={() => saveNumberRouting(routingModalNumber, rec.id)}
                    disabled={routingSaving}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50",
                      isSelected ? "bg-primary/5" : "hover:bg-secondary"
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={cn(rec.color, "text-primary-foreground text-[10px] font-semibold")}>
                        {rec.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight text-foreground">{rec.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatPhoneDisplay(rec.phone)}</p>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Selected
                      </span>
                    )}
                  </button>
                )
              })}

              {receptionistsList.length === 0 && (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No receptionists added yet. Add one from the dashboard to route calls to them.
                  </p>
                </div>
              )}
            </div>

            {routingSaving && (
              <div className="flex items-center justify-center gap-2 border-t border-border py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Saving…</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Account */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h3>
        <div className="flex flex-col gap-2">
          <a
            href={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || "/privacy"}
            target={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? "_blank" : undefined}
            rel={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? "noopener noreferrer" : undefined}
            className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <IconSurface>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </IconSurface>
              <p className="text-sm font-medium text-foreground">
                Security & Privacy
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>

          <a
            href={process.env.NEXT_PUBLIC_SUPPORT_URL || "/support"}
            target={process.env.NEXT_PUBLIC_SUPPORT_URL ? "_blank" : undefined}
            rel={process.env.NEXT_PUBLIC_SUPPORT_URL ? "noopener noreferrer" : undefined}
            className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <IconSurface>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </IconSurface>
              <p className="text-sm font-medium text-foreground">
                Help & Support
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>

          <button className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-destructive/5">
            <div className="flex items-center gap-3">
              <IconSurface tone="danger">
                <LogOut className="h-4 w-4 text-destructive" />
              </IconSurface>
              <p className="text-sm font-medium text-destructive">Sign Out</p>
            </div>
          </button>
        </div>
      </section>

      {/* Version */}
      <p className="text-center text-xs text-muted-foreground">
        Zing v1.0.0
      </p>
    </div>
  )
}
