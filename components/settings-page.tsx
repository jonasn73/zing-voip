"use client"

import { useState, useEffect } from "react"
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

// Format E.164 phone for display, e.g. +15551234567 -> (555) 123-4567. Safe for null/undefined or non-string (e.g. from API).
function formatPhoneDisplay(phone: string | undefined | null): string {
  if (phone == null || typeof phone !== "string") return "your cell"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

export function SettingsPage() {
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
  const [editingMainLine, setEditingMainLine] = useState(false)
  const [mainLineEdit, setMainLineEdit] = useState("")
  const [mainLineSaveLoading, setMainLineSaveLoading] = useState(false)
  const [mainLineError, setMainLineError] = useState<string | null>(null)

  // Per-number routing state
  const [receptionistsList, setReceptionistsList] = useState<ReceptionistInfo[]>([])
  const [numberRoutings, setNumberRoutings] = useState<NumberRouting[]>([])
  const [routingModalNumber, setRoutingModalNumber] = useState<string | null>(null) // E.164 number being configured, or null if closed
  const [routingSaving, setRoutingSaving] = useState(false)

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

  const availableNumbers = [
    { number: `(${selectedAreaCode || "555"}) 100-4001`, type: "Local", price: "$2.99/mo" },
    { number: `(${selectedAreaCode || "555"}) 100-4022`, type: "Local", price: "$2.99/mo" },
    { number: `(${selectedAreaCode || "555"}) 888-7100`, type: "Toll-Free", price: "$4.99/mo" },
    { number: `(${selectedAreaCode || "555"}) 100-4055`, type: "Local", price: "$2.99/mo" },
  ]

  // Business numbers = numbers customers call (bought or ported). Your main line (cell) is in the profile above.
  const myNumbers: { number: string; label: string; type: string; status: "active" }[] = []

  function handleSearchNumbers() {
    setBuyLoading(true)
    setTimeout(() => {
      setBuyLoading(false)
      setBuyStep("results")
    }, 800)
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
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortError(data.error || "Failed to start port")
        return
      }
      setPortSubmitMessage(data.message || "Your number is being transferred to Zing.")
      setPortSubmitted(true)
      const portingRes = await fetch("/api/numbers/porting", { credentials: "include" })
      const portingData = await portingRes.json()
      if (Array.isArray(portingData.porting)) setPortingNumbers(portingData.porting)
    } catch {
      setPortError("Failed to start port. Try again.")
    } finally {
      setPortSubmitLoading(false)
    }
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
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
            ME
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground">{user?.name ?? "My Business"}</p>
          <p className="text-sm text-muted-foreground">{user?.email || "owner@mybusiness.com"}</p>
          {editingMainLine ? (
            <div className="mt-2 space-y-2">
              <input
                type="tel"
                value={mainLineEdit}
                onChange={(e) => setMainLineEdit(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {mainLineSaveLoading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditMainLine}
                  disabled={mainLineSaveLoading}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Main line: {formatPhoneDisplay(user?.phone)} — calls default here when no receptionist is selected.{" "}
              <button
                type="button"
                onClick={startEditMainLine}
                className="font-medium text-primary underline hover:no-underline"
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
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Business numbers
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Numbers your customers call (buy or port). Calls to these numbers ring your main line above or a receptionist.
        </p>
        <div className="flex flex-col gap-2">
          {myNumbers.map((num) => {
            const routing = getRoutingForNumber(num.number)
            return (
              <button
                key={num.number}
                onClick={() => setRoutingModalNumber(num.number)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{num.number}</p>
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
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-6">
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
                  "flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left",
                  isComplete && "transition-all hover:border-primary/30 hover:bg-primary/5"
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
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
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
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-all hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
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
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Call Routing
        </h3>
        <div className="flex flex-col gap-2">
          {settings.map((setting) => {
            const Icon = setting.icon
            return (
              <div
                key={setting.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className={cn("h-4 w-4", setting.iconColor)} />
                  </div>
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

      {/* Schedule */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule
        </h3>
        <button className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Clock className="h-4 w-4 text-primary" />
            </div>
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
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setShowNumberModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Get a Number</h3>
              <button
                onClick={() => setShowNumberModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
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
                          className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSearchNumbers}
                        disabled={selectedAreaCode.length < 3}
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                      >
                        {buyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Available numbers in ({selectedAreaCode})</p>
                      <button
                        onClick={() => setBuyStep("search")}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    {availableNumbers.map((num) => (
                      <button
                        key={num.number}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{num.number}</p>
                          <p className="text-[11px] text-muted-foreground">{num.type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{num.price}</span>
                          <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Select
                          </span>
                        </div>
                      </button>
                    ))}
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
                      className="mt-2 rounded-lg bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
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
                        <div className="flex items-start gap-2.5 rounded-lg bg-secondary p-3">
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
                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                            autoFocus
                          />
                        </div>
                        {portError && <p className="text-xs text-destructive">{portError}</p>}
                        <button
                          onClick={() => { setPortError(null); setPortStep(2) }}
                          disabled={!portNumber.replace(/\D/g, "").length}
                          className="mt-1 w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
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
                          <input type="text" placeholder="Your name or business name" value={portAccountName} onChange={(e) => setPortAccountName(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" autoFocus />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Authorized person (who can approve the transfer)</label>
                          <input type="text" placeholder="Your full name" value={portAuthPerson} onChange={(e) => setPortAuthPerson(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Account number (optional)</label>
                          <input type="text" placeholder="From your current provider's bill" value={portAccountNumber} onChange={(e) => setPortAccountNumber(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">Account PIN (optional)</label>
                          <input type="text" placeholder="If your carrier requires a PIN" value={portPin} onChange={(e) => setPortPin(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setPortStep(1)} className="flex-1 rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground hover:bg-muted">Back</button>
                          <button onClick={() => setPortStep(3)} disabled={!portAccountName || !portAuthPerson} className="flex-1 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">Next: Address</button>
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
                          <input type="text" placeholder="123 Main St" value={portStreet} onChange={(e) => setPortStreet(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" autoFocus />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1 flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">City</label>
                            <input type="text" placeholder="City" value={portCity} onChange={(e) => setPortCity(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                          <div className="col-span-1 flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">State</label>
                            <input type="text" placeholder="KY" maxLength={2} value={portState} onChange={(e) => setPortState(e.target.value.toUpperCase())} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                          <div className="col-span-1 flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">ZIP</label>
                            <input type="text" placeholder="40000" maxLength={5} value={portZip} onChange={(e) => setPortZip(e.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        {portError && <p className="text-xs text-destructive">{portError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => setPortStep(2)} disabled={portSubmitLoading} className="flex-1 rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">Back</button>
                          <button onClick={handlePortSubmit} disabled={!portStreet || !portCity || !portState || !portZip || portSubmitLoading} className="flex-1 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
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
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setRoutingModalNumber(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Route Calls</h3>
                <p className="text-xs text-muted-foreground">{formatPhoneDisplay(routingModalNumber)}</p>
              </div>
              <button
                onClick={() => setRoutingModalNumber(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
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
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h3>
        <div className="flex flex-col gap-2">
          <a
            href={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || "/privacy"}
            target={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? "_blank" : undefined}
            rel={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? "noopener noreferrer" : undefined}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
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
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Help & Support
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>

          <button className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-destructive/5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
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
