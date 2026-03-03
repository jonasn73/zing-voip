"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
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
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { fetcher, fetchJson } from "@/lib/fetcher"
import type { Receptionist, RoutingConfig } from "@/lib/types"

interface CallStat {
  label: string
  value: number
  icon: React.ElementType
  color: string
  bgColor: string
}

const callStatsConfig = [
  { label: "Total Calls", key: "total" as const, icon: Phone, color: "text-primary", bgColor: "bg-primary/10" },
  { label: "Incoming", key: "incoming" as const, icon: PhoneIncoming, color: "text-success", bgColor: "bg-success/10" },
  { label: "Outgoing", key: "outgoing" as const, icon: PhoneOutgoing, color: "text-chart-2", bgColor: "bg-chart-2/10" },
  { label: "Missed", key: "missed" as const, icon: PhoneMissed, color: "text-destructive", bgColor: "bg-destructive/10" },
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

function formatRelativeTime(createdAt: string): string {
  const sec = (Date.now() - new Date(createdAt).getTime()) / 1000
  if (sec < 60) return "Just now"
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`
  return new Date(createdAt).toLocaleDateString()
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function DashboardPage() {
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [showFallbackSettings, setShowFallbackSettings] = useState(false)
  const [editingGreeting, setEditingGreeting] = useState(false)
  const [greetingDraft, setGreetingDraft] = useState("")

  const { data: sessionData } = useSWR<{ data: { user: { id: string; name: string; phone: string } } }>("/api/auth/session", fetcher)
  const { data: routingData, mutate: mutateRouting } = useSWR<{ config: RoutingConfig | null; receptionists: Receptionist[] }>("/api/routing", fetcher)
  const { data: callsData } = useSWR<{ calls: { id: string; from_number: string; caller_name: string | null; call_type: string; created_at: string; duration_seconds: number; routed_to_name: string | null }[] }>("/api/calls?limit=20", fetcher)

  const user = sessionData?.data?.user
  const config = routingData?.config
  const receptionists = routingData?.receptionists ?? []
  const calls = callsData?.calls ?? []

  const selectedReceptionistId = config?.selected_receptionist_id ?? null
  const fallback = (config?.fallback_type as FallbackOption) ?? "owner"
  const aiGreeting = config?.ai_greeting ?? "Thank you for calling. Our team is currently unavailable. I can take a message, provide our business hours, or help direct your call. How can I help you?"
  const selectedReceptionist = receptionists.find((c) => c.id === selectedReceptionistId) ?? null
  const isRoutingToOwner = !selectedReceptionist

  const ownerInfo = user ? { name: "You", phone: user.phone } : { name: "You", phone: "—" }

  useEffect(() => {
    if (config && !editingGreeting) setGreetingDraft(config.ai_greeting)
  }, [config?.ai_greeting, editingGreeting])

  const callStats: CallStat[] = callStatsConfig.map((c) => ({
    ...c,
    value: c.key === "total" ? calls.length : calls.filter((x) => x.call_type === c.key).length,
  }))
  const totalTalkSeconds = calls.reduce((s, c) => s + c.duration_seconds, 0)
  const totalTalkTime = { hours: Math.floor(totalTalkSeconds / 3600), minutes: Math.floor((totalTalkSeconds % 3600) / 60) }

  const recentCalls = calls.slice(0, 8).map((call) => ({
    id: call.id,
    number: call.from_number,
    callerName: call.caller_name,
    type: call.call_type as "incoming" | "outgoing" | "missed" | "voicemail",
    time: formatRelativeTime(call.created_at),
    duration: call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : null,
    routedTo: call.routed_to_name,
  }))

  async function selectReceptionist(id: string) {
    await fetchJson("/api/routing", { method: "PUT", body: { selected_receptionist_id: id } })
    mutateRouting()
    setShowSwitcher(false)
  }

  async function clearReceptionist() {
    await fetchJson("/api/routing", { method: "PUT", body: { selected_receptionist_id: null } })
    mutateRouting()
    setShowSwitcher(false)
  }

  async function setFallbackAndSave(value: FallbackOption) {
    await fetchJson("/api/routing", { method: "PUT", body: { fallback_type: value } })
    mutateRouting()
  }

  async function saveAiGreeting(value: string) {
    await fetchJson("/api/routing", { method: "PUT", body: { ai_greeting: value } })
    setEditingGreeting(false)
    mutateRouting()
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
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 shadow-[0_0_30px_-5px_var(--primary)]">
            <PhoneForwarded className="h-8 w-8 text-primary" />
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Calls Are Being Routed
            </h2>
            <p className="text-xs text-muted-foreground">Everything is configured in the app—no Twilio setup needed.</p>
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
                {isRoutingToOwner ? ownerInfo.phone : selectedReceptionist!.phone}
              </p>

              {/* Fallback: what happens when the person who receives calls doesn't answer */}
              {(() => {
                const activeFallback = fallbackOptions.find((f) => f.id === fallback)!
                const FallbackIcon = activeFallback.icon
                return (
                  <button
                    onClick={() => setShowFallbackSettings(true)}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 transition-all hover:bg-secondary active:scale-[0.99]"
                  >
                    <FallbackIcon className={cn("h-3.5 w-3.5 shrink-0", activeFallback.color)} />
                    <p className="text-left text-[11px] text-muted-foreground">
                      {isRoutingToOwner ? "If you don't answer: " : "If no answer: "}
                      <span className="font-medium text-foreground">{activeFallback.label}</span>
                    </p>
                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                )
              })()}

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
                          <p className="text-[11px] text-muted-foreground">{ownerInfo.phone} (default)</p>
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

                      {receptionists.map((contact) => {
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
                              <p className="text-[11px] text-muted-foreground">{contact.phone}</p>
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
                      <h3 className="text-sm font-semibold text-foreground">When no one answers</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isRoutingToOwner
                          ? "Choose what happens when you don't pick up"
                          : `What happens if ${selectedReceptionist?.name.split(" ")[0]} doesn't answer`}
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
                          onClick={() => setFallbackAndSave(option.id)}
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
                              onClick={() => saveAiGreeting(greetingDraft)}
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

        <div className="mt-2 flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">Recent calls from your log</span>
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
