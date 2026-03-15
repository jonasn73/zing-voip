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
  const [selectedAreaCode, setSelectedAreaCode] = useState("")
  const [buyStep, setBuyStep] = useState<"search" | "results">("search")
  const [buyLoading, setBuyLoading] = useState(false)
  const [portingNumbers, setPortingNumbers] = useState<{ id: string; number: string; status: string }[]>([])
  const [portingLoading, setPortingLoading] = useState(false)
  const [portSubmitLoading, setPortSubmitLoading] = useState(false)
  const [portError, setPortError] = useState<string | null>(null)
  const [editingMainLine, setEditingMainLine] = useState(false)
  const [mainLineEdit, setMainLineEdit] = useState("")
  const [mainLineSaveLoading, setMainLineSaveLoading] = useState(false)
  const [mainLineError, setMainLineError] = useState<string | null>(null)

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
      const raw = portNumber.replace(/\D/g, "")
      const number = raw.length === 10 ? `+1${raw}` : raw.length === 11 && raw.startsWith("1") ? `+${raw}` : portNumber
      const res = await fetch("/api/numbers/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ number, current_carrier: portCarrier || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortError(data.error || "Failed to start port")
        return
      }
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
          {myNumbers.map((num) => (
            <div
              key={num.number}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{num.number}</p>
                  <p className="text-xs text-muted-foreground">{num.label} &middot; {num.type}</p>
                </div>
              </div>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                Active
              </span>
            </div>
          ))}

          {portingLoading && portingNumbers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading port status…</span>
            </div>
          ) : null}
          {portingNumbers.map((p) => (
            <div
              key={p.id || p.number}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                  <ArrowRightLeft className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{formatPhoneDisplay(p.number)}</p>
                  <p className="text-xs text-muted-foreground">Porting to Zing · Usually 24-48 hours</p>
                </div>
              </div>
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                Porting
              </span>
            </div>
          ))}

          <button
            onClick={() => { setShowNumberModal(true); setNumberTab("buy"); setBuyStep("search"); setSelectedAreaCode(""); setPortSubmitted(false); setPortNumber(""); setPortCarrier("") }}
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

            {/* Port tab */}
            {numberTab === "port" && (
              <div className="p-4">
                {portSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <Check className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Port Request Submitted</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your port has been started with Telnyx—the number will transfer to Zing, usually within 24–48 hours. Check this page for progress; complete any LOA or verification steps Telnyx emails you.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNumberModal(false)}
                      className="mt-2 rounded-lg bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2.5 rounded-lg bg-secondary p-3">
                      <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Port your existing business number to Zing. No downtime, no missed calls. Takes 24-48 hours.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={portNumber}
                        onChange={(e) => setPortNumber(e.target.value)}
                        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Current carrier (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. AT&T, Verizon, T-Mobile — we can look it up if you don't know"
                        value={portCarrier}
                        onChange={(e) => setPortCarrier(e.target.value)}
                        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    {portError && (
                      <p className="text-xs text-destructive">{portError}</p>
                    )}
                    <button
                      onClick={handlePortSubmit}
                      disabled={!portNumber || portSubmitLoading}
                      className="mt-1 w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                      {portSubmitLoading ? (
                        <>
                          <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                          Starting port…
                        </>
                      ) : (
                        "Submit Port Request"
                      )}
                    </button>
                  </div>
                )}
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
          <button className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Security & Privacy
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <button className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Help & Support
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

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
