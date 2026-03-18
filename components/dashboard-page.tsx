"use client"

import { useState, useEffect } from "react"
import {
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Clock,
  TrendingUp,
  Voicemail,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  X,
  User,
  Bot,
  ChevronRight,
  Check,
  Plus,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Format E.164 to display, e.g. +15025551234 -> (502) 555-1234
function formatPhoneDisplay(phone: string | undefined | null): string {
  if (phone == null || typeof phone !== "string") return "Your cell"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

interface Contact {
  id: string
  name: string
  phone: string
  initials: string
  color: string
}

interface CallStat {
  label: string
  value: number
  icon: React.ElementType
  color: string
  bgColor: string
  suffix?: string
}

const callStats: CallStat[] = [
  { label: "Total Calls", value: 147, icon: Phone, color: "text-primary", bgColor: "bg-primary/10" },
  { label: "Incoming", value: 89, icon: PhoneIncoming, color: "text-success", bgColor: "bg-success/10" },
  { label: "Outgoing", value: 42, icon: PhoneOutgoing, color: "text-chart-2", bgColor: "bg-chart-2/10" },
  { label: "Missed", value: 16, icon: PhoneMissed, color: "text-destructive", bgColor: "bg-destructive/10" },
]

const totalTalkTime = { hours: 12, minutes: 34 }

interface RecentCall {
  id: string
  number: string
  callerName: string | null
  type: "incoming" | "outgoing" | "missed" | "voicemail"
  time: string
  duration: string | null
  routedTo: string | null
}

const recentCalls: RecentCall[] = [
  { id: "r1", number: "(555) 901-2345", callerName: "David Chen", type: "incoming", time: "2 min ago", duration: "4:12", routedTo: "Sarah Miller" },
  { id: "r2", number: "(555) 678-1234", callerName: null, type: "missed", time: "18 min ago", duration: null, routedTo: null },
  { id: "r3", number: "(555) 432-8765", callerName: "Apex Industries", type: "incoming", time: "45 min ago", duration: "11:03", routedTo: "Sarah Miller" },
  { id: "r4", number: "(555) 222-9988", callerName: null, type: "voicemail", time: "1 hr ago", duration: "0:42", routedTo: null },
  { id: "r5", number: "(555) 111-4455", callerName: "Lisa Park", type: "outgoing", time: "1.5 hr ago", duration: "7:28", routedTo: null },
  { id: "r6", number: "(555) 876-5432", callerName: "Metro Supplies", type: "incoming", time: "2 hr ago", duration: "3:55", routedTo: "James Wilson" },
  { id: "r7", number: "(555) 333-7766", callerName: null, type: "missed", time: "3 hr ago", duration: null, routedTo: null },
  { id: "r8", number: "(555) 999-1122", callerName: "Amy Torres", type: "incoming", time: "4 hr ago", duration: "8:16", routedTo: "Sarah Miller" },
]

const callTypeConfig = {
  incoming: { icon: ArrowDownLeft, color: "text-success", label: "Incoming" },
  outgoing: { icon: ArrowUpRight, color: "text-chart-2", label: "Outgoing" },
  missed: { icon: PhoneMissed, color: "text-destructive", label: "Missed" },
  voicemail: { icon: Voicemail, color: "text-warning", label: "Voicemail" },
}

type FallbackOption = "owner" | "ai" | "voicemail"

const fallbackOptions: { id: FallbackOption; label: string; description: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { id: "owner", label: "Ring Your Phone", description: "Call forwards to your cell phone", icon: Phone, color: "text-primary", bgColor: "bg-primary/10" },
  { id: "ai", label: "AI Assistant", description: "AI answers, takes messages, and guides callers", icon: Bot, color: "text-chart-4", bgColor: "bg-chart-4/10" },
  { id: "voicemail", label: "Voicemail", description: "Send caller to voicemail", icon: Voicemail, color: "text-warning", bgColor: "bg-warning/10" },
]

export function DashboardPage() {
  const [mainLinePhone, setMainLinePhone] = useState<string | null>(null)
  const [receptionists, setReceptionists] = useState<Contact[]>([])
  const [selectedReceptionistId, setSelectedReceptionistId] = useState<string | null>(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [fallback, setFallback] = useState<FallbackOption>("owner")
  const [showFallbackSettings, setShowFallbackSettings] = useState(false)
  const [aiGreeting, setAiGreeting] = useState("Thank you for calling. Our team is currently unavailable. I can take a message, provide our business hours, or help direct your call. How can I help you?")
  const [editingGreeting, setEditingGreeting] = useState(false)
  const [greetingDraft, setGreetingDraft] = useState("")

  // Add receptionist state
  const [showAddReceptionist, setShowAddReceptionist] = useState(false)
  const [newRecName, setNewRecName] = useState("")
  const [newRecPhone, setNewRecPhone] = useState("")
  const [addRecLoading, setAddRecLoading] = useState(false)
  const [addRecError, setAddRecError] = useState<string | null>(null)
  const [deletingRecId, setDeletingRecId] = useState<string | null>(null)

  // AI assistant state
  const [hasVapiAssistant, setHasVapiAssistant] = useState(false)
  const [activatingAi, setActivatingAi] = useState(false)

  // Business numbers for showing which number routing applies to
  const [businessNumbers, setBusinessNumbers] = useState<{ number: string; status: string }[]>([])

  // Load user session
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.user?.phone) setMainLinePhone(data.data.user.phone)
      })
      .catch(() => {})
  }, [])

  // Load real receptionists from API
  useEffect(() => {
    fetch("/api/receptionists", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        if (Array.isArray(data.data)) {
          setReceptionists(data.data.map((r: Record<string, string>) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            initials: r.initials || r.name?.slice(0, 2)?.toUpperCase() || "??",
            color: r.color || "bg-primary",
          })))
        }
      })
      .catch(() => {})
  }, [])

  // Load business numbers first, then load routing for the primary number
  useEffect(() => {
    fetch("/api/numbers/mine", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { numbers: [] }))
      .then((data) => {
        if (Array.isArray(data.numbers)) {
          const active = data.numbers.filter((n: Record<string, string>) => n.status === "active").map((n: Record<string, string>) => ({
            number: n.number,
            status: n.status,
          }))
          setBusinessNumbers(active)

          // Load routing for the first active business number (per-number config)
          // Falls back to default config on the server if no per-number config exists
          const primaryNumber = active[0]?.number
          const routingUrl = primaryNumber
            ? `/api/routing?number=${encodeURIComponent(primaryNumber)}`
            : "/api/routing"
          fetch(routingUrl, { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((rData) => {
              if (rData?.config) {
                setSelectedReceptionistId(rData.config.selected_receptionist_id || null)
                setFallback(rData.config.fallback_type || "owner")
                if (rData.config.ai_greeting) setAiGreeting(rData.config.ai_greeting)
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  // Check if user has a Vapi AI assistant
  useEffect(() => {
    fetch("/api/ai-assistant", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hasAssistant) setHasVapiAssistant(true)
      })
      .catch(() => {})
  }, [])

  const ownerPhoneDisplay = formatPhoneDisplay(mainLinePhone)
  const selectedReceptionist = receptionists.find((c) => c.id === selectedReceptionistId) || null
  const isRoutingToOwner = !selectedReceptionist

  // Save routing for the primary business number (or default if none)
  function saveRouting(updates: Record<string, unknown>) {
    const primaryNumber = businessNumbers[0]?.number || null
    fetch("/api/routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...updates, business_number: primaryNumber }),
    }).catch(() => {})
  }

  function selectReceptionist(id: string) {
    setSelectedReceptionistId(id)
    setShowSwitcher(false)
    saveRouting({ selected_receptionist_id: id })
  }

  function clearReceptionist() {
    setSelectedReceptionistId(null)
    setShowSwitcher(false)
    saveRouting({ selected_receptionist_id: null })
  }

  async function handleAddReceptionist() {
    if (!newRecName.trim() || !newRecPhone.trim()) return
    setAddRecLoading(true)
    setAddRecError(null)
    try {
      const res = await fetch("/api/receptionists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newRecName.trim(), phone: newRecPhone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddRecError(data.error || "Failed to add receptionist")
        return
      }
      const r = data.data
      setReceptionists((prev) => [...prev, {
        id: r.id,
        name: r.name,
        phone: r.phone,
        initials: r.initials || r.name.slice(0, 2).toUpperCase(),
        color: r.color || "bg-primary",
      }])
      setNewRecName("")
      setNewRecPhone("")
      setShowAddReceptionist(false)
    } catch {
      setAddRecError("Something went wrong")
    } finally {
      setAddRecLoading(false)
    }
  }

  async function handleDeleteReceptionist(id: string) {
    if (!confirm("Remove this receptionist?")) return
    setDeletingRecId(id)
    try {
      const res = await fetch(`/api/receptionists/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        setReceptionists((prev) => prev.filter((r) => r.id !== id))
        if (selectedReceptionistId === id) clearReceptionist()
      }
    } catch { /* silent */ }
    setDeletingRecId(null)
  }

  async function handleActivateAi() {
    setActivatingAi(true)
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) setHasVapiAssistant(true)
    } catch { /* silent */ }
    setActivatingAi(false)
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      {/* Routing Status */}
      <section className="relative rounded-2xl border border-border bg-card p-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, oklch(0.72 0.17 175 / 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-5">
          {/* Centered icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 shadow-[0_0_30px_-5px_var(--primary)]">
            <PhoneForwarded className="h-8 w-8 text-primary" />
          </div>

          {/* Status text + routing target */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Calls Are Being Routed
            </h2>

            {/* Show which business number(s) this routing applies to */}
            {businessNumbers.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {businessNumbers.map((bn) => (
                  <span
                    key={bn.number}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {formatPhoneDisplay(bn.number)}
                  </span>
                ))}
              </div>
            )}

            <div className="relative flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {isRoutingToOwner ? "Ringing directly to" : "Ringing first to"}
              </p>
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className={cn(
                  "flex items-center gap-2.5 rounded-full border px-4 py-2 transition-all hover:bg-primary/15 active:scale-[0.98]",
                  isRoutingToOwner
                    ? "border-border bg-secondary"
                    : "border-primary/30 bg-primary/10"
                )}
                aria-expanded={showSwitcher}
                aria-haspopup="listbox"
              >
                {isRoutingToOwner ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted-foreground/20">
                    <User className="h-3.5 w-3.5 text-foreground" />
                  </div>
                ) : (
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={cn(selectedReceptionist!.color, "text-primary-foreground text-[10px] font-semibold")}>
                      {selectedReceptionist!.initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className={cn(
                  "text-base font-semibold",
                  isRoutingToOwner ? "text-foreground" : "text-primary"
                )}>
                  {isRoutingToOwner ? "Your Phone" : selectedReceptionist!.name}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showSwitcher && "rotate-180"
                )} />
              </button>
              <p className="text-xs text-muted-foreground">
                {isRoutingToOwner ? ownerPhoneDisplay : formatPhoneDisplay(selectedReceptionist!.phone)}
              </p>

              {/* Fallback setting */}
              {selectedReceptionist && (() => {
                const activeFallback = fallbackOptions.find((f) => f.id === fallback)!
                const FallbackIcon = activeFallback.icon
                return (
                  <button
                    onClick={() => setShowFallbackSettings(true)}
                    className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 transition-all hover:bg-secondary active:scale-[0.99]"
                  >
                    <FallbackIcon className={cn("h-3.5 w-3.5", activeFallback.color)} />
                    <p className="text-[11px] text-muted-foreground">
                      {"If no answer: "}
                      <span className="font-medium text-foreground">{activeFallback.label}</span>
                    </p>
                    <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </button>
                )
              })()}

              {/* Switcher dropdown */}
              {showSwitcher && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
                    onClick={() => setShowSwitcher(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Route calls to
                      </span>
                      <button
                        onClick={() => setShowSwitcher(false)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-col py-1" role="listbox" aria-label="Select who receives calls">
                      {/* Owner / default */}
                      <button
                        onClick={clearReceptionist}
                        role="option"
                        aria-selected={isRoutingToOwner}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                          isRoutingToOwner ? "bg-secondary/50" : "hover:bg-secondary"
                        )}
                      >
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full",
                          isRoutingToOwner ? "bg-foreground/15" : "bg-muted-foreground/15"
                        )}>
                          <User className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium leading-tight text-foreground">Your Phone</p>
                          <p className="text-[11px] text-muted-foreground">{ownerPhoneDisplay} (default)</p>
                        </div>
                        {isRoutingToOwner && (
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                            Current
                          </span>
                        )}
                      </button>

                      <div className="mx-4 border-b border-border" />
                      <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Receptionists
                      </p>

                      {receptionists.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                          No receptionists added yet. Add one in Settings to route calls to them.
                        </p>
                      ) : receptionists.map((contact) => {
                        const isSelected = contact.id === selectedReceptionistId
                        return (
                          <button
                            key={contact.id}
                            onClick={() => selectReceptionist(contact.id)}
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                              isSelected ? "bg-primary/5" : "hover:bg-secondary"
                            )}
                          >
                            <div className="relative">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={cn(contact.color, "text-primary-foreground text-xs font-semibold")}>
                                  {contact.initials}
                                </AvatarFallback>
                              </Avatar>
                              {isSelected && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-medium leading-tight",
                                isSelected ? "text-primary" : "text-foreground"
                              )}>
                                {contact.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{formatPhoneDisplay(contact.phone)}</p>
                            </div>
                            {isSelected && (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Active
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Fallback Settings Modal */}
            {showFallbackSettings && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
                  onClick={() => { setShowFallbackSettings(false); setEditingGreeting(false) }}
                  aria-hidden="true"
                />
                <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Fallback Settings</h3>
                      <p className="text-[11px] text-muted-foreground">
                        What happens if {selectedReceptionist?.name.split(" ")[0]} doesn{"'"}t answer
                      </p>
                    </div>
                    <button
                      onClick={() => { setShowFallbackSettings(false); setEditingGreeting(false) }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Close fallback settings"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 p-2">
                    {fallbackOptions.map((option) => {
                      const Icon = option.icon
                      const isActive = fallback === option.id
                      return (
                        <button
                          key={option.id}
                          onClick={() => {
                            setFallback(option.id)
                            saveRouting({ fallback_type: option.id })
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all",
                            isActive
                              ? "bg-primary/5 ring-1 ring-primary/30"
                              : "hover:bg-secondary"
                          )}
                        >
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", option.bgColor)}>
                            <Icon className={cn("h-5 w-5", option.color)} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium leading-tight text-foreground">
                              {option.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{option.description}</p>
                          </div>
                          {isActive && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* AI Config -- only visible when AI is selected */}
                  {fallback === "ai" && (
                    <div className="border-t border-border px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-chart-4" />
                          <span className="text-xs font-semibold text-foreground">AI Greeting</span>
                        </div>
                        {!editingGreeting && (
                          <button
                            onClick={() => { setEditingGreeting(true); setGreetingDraft(aiGreeting) }}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingGreeting ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={greetingDraft}
                            onChange={(e) => setGreetingDraft(e.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                            placeholder="Enter what the AI should say..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setAiGreeting(greetingDraft)
                                setEditingGreeting(false)
                                saveRouting({ ai_greeting: greetingDraft })
                              }}
                              className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingGreeting(false)}
                              className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          {'"'}{aiGreeting}{'"'}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          AI can also
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Take messages", "Share business hours", "Book appointments", "Answer FAQs"].map((capability) => (
                            <span
                              key={capability}
                              className="rounded-full bg-chart-4/10 px-2.5 py-1 text-[10px] font-medium text-chart-4"
                            >
                              {capability}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Receptionists */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Receptionists
          </h3>
          <button
            onClick={() => { setShowAddReceptionist(true); setAddRecError(null) }}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {receptionists.length === 0 && !showAddReceptionist ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
            <User className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No receptionists yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a receptionist to route calls to them instead of your phone.</p>
            <button
              onClick={() => setShowAddReceptionist(true)}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add Receptionist
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {receptionists.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={cn(rec.color, "text-primary-foreground text-xs font-semibold")}>
                      {rec.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{rec.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatPhoneDisplay(rec.phone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedReceptionistId === rec.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Active
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteReceptionist(rec.id)}
                    disabled={deletingRecId === rec.id}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${rec.name}`}
                  >
                    {deletingRecId === rec.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Receptionist form */}
        {showAddReceptionist && (
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Name</label>
                <input
                  type="text"
                  placeholder="Sarah Miller"
                  value={newRecName}
                  onChange={(e) => setNewRecName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Phone number</label>
                <input
                  type="tel"
                  placeholder="(555) 234-5678"
                  value={newRecPhone}
                  onChange={(e) => setNewRecPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              {addRecError && <p className="text-xs text-destructive">{addRecError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddReceptionist}
                  disabled={addRecLoading || !newRecName.trim() || !newRecPhone.trim()}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {addRecLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add"}
                </button>
                <button
                  onClick={() => { setShowAddReceptionist(false); setNewRecName(""); setNewRecPhone(""); setAddRecError(null) }}
                  disabled={addRecLoading}
                  className="rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* AI Assistant */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            AI Assistant
          </h3>
        </div>
        {hasVapiAssistant ? (
          <div className="rounded-xl border border-chart-4/20 bg-chart-4/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <Sparkles className="h-5 w-5 text-chart-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">AI Receptionist Active</p>
                <p className="text-[11px] text-muted-foreground">
                  Handles calls when no one answers — takes messages, shares hours, books appointments
                </p>
              </div>
              <span className="rounded-full bg-chart-4/10 px-2 py-0.5 text-[10px] font-semibold text-chart-4">
                On
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-chart-4/30 bg-chart-4/5 p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-chart-4/60" />
            <p className="text-sm font-medium text-foreground">AI Receptionist</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When no one answers, an AI agent picks up — takes messages, shares business hours, and books appointments. Sounds like a real person.
            </p>
            <button
              onClick={handleActivateAi}
              disabled={activatingAi}
              className="mt-3 rounded-lg bg-chart-4 px-5 py-2 text-xs font-semibold text-white hover:bg-chart-4/90 disabled:opacity-50"
            >
              {activatingAi ? (
                <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Setting up…</span>
              ) : (
                "Activate AI Assistant"
              )}
            </button>
          </div>
        )}
      </section>

      {/* Call Stats */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Call Stats
          </h3>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {callStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bgColor)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Talk Time Summary */}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Total Talk Time</p>
              <p className="text-[11px] text-muted-foreground">All calls this month</p>
            </div>
          </div>
          <div className="flex items-baseline gap-1 text-right">
            <span className="text-xl font-bold text-foreground">{totalTalkTime.hours}</span>
            <span className="text-xs text-muted-foreground">hr</span>
            <span className="text-xl font-bold text-foreground">{totalTalkTime.minutes}</span>
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>

        {/* Trend */}
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">+12% more calls vs last month</span>
        </div>
      </section>

      {/* Recent Calls */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Calls
          </h3>
          <span className="text-xs text-muted-foreground">{recentCalls.length} calls today</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {recentCalls.map((call) => {
            const config = callTypeConfig[call.type]
            const TypeIcon = config.icon
            return (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    call.type === "missed" ? "bg-destructive/10" :
                    call.type === "voicemail" ? "bg-warning/10" :
                    call.type === "outgoing" ? "bg-chart-2/10" :
                    "bg-success/10"
                  )}>
                    <TypeIcon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {call.callerName || call.number}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {call.callerName && (
                        <span className="text-[11px] text-muted-foreground">{call.number}</span>
                      )}
                      {call.callerName && call.routedTo && (
                        <span className="text-[11px] text-muted-foreground">{"·"}</span>
                      )}
                      {call.routedTo && (
                        <span className="text-[11px] text-primary/70">
                          {"Routed to " + call.routedTo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] text-muted-foreground">{call.time}</span>
                  {call.duration ? (
                    <span className="flex items-center gap-1 text-[11px] text-foreground/70">
                      <Clock className="h-3 w-3" />
                      {call.duration}
                    </span>
                  ) : (
                    <span className="text-[11px] text-destructive">{config.label}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
