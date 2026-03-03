"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Phone,
  ArrowRight,
  ArrowRightLeft,
  Hash,
  Loader2,
  Check,
  Plus,
  Sparkles,
} from "lucide-react"
import { fetchJson } from "@/lib/fetcher"
import { formatPhone } from "@/lib/utils"

interface OnboardingPageProps {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(1)
  const [step1Submitting, setStep1Submitting] = useState(false)

  const [numberMethod, setNumberMethod] = useState<"buy" | "port" | null>(null)
  const [areaCode, setAreaCode] = useState("")
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState("")
  const [selectedRaw, setSelectedRaw] = useState("")
  const [availableNumbers, setAvailableNumbers] = useState<{ raw: string; number: string; type: string; price: string }[]>([])
  const [numberError, setNumberError] = useState("")
  const [portNumber, setPortNumber] = useState("")
  const [portCarrier, setPortCarrier] = useState("")
  const [porting, setPorting] = useState(false)

  const [receptionistName, setReceptionistName] = useState("")
  const [receptionistPhone, setReceptionistPhone] = useState("")
  const [receptionistRate, setReceptionistRate] = useState("")
  const [addedReceptionist, setAddedReceptionist] = useState(false)
  const [addingReceptionist, setAddingReceptionist] = useState(false)

  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiGreeting, setAiGreeting] = useState(
    "Thank you for calling. Our team is currently unavailable. I can take a message, provide our business hours, or help direct your call. How can I help you?"
  )
  const [launching, setLaunching] = useState(false)

  async function handleSearch() {
    setNumberError("")
    setSearching(true)
    try {
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ area_code: areaCode, type: "local" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Search failed")
      setAvailableNumbers((data as { numbers: { number: string; friendly_name: string; type: string }[] }).numbers.map((n) => ({
        raw: n.number,
        number: formatPhone(n.number),
        type: n.type === "local" ? "Local" : "Toll-Free",
        price: "$2.99/mo",
      })))
      setShowResults(true)
    } catch (e) {
      setNumberError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  async function handleAddReceptionist() {
    setNumberError("")
    setAddingReceptionist(true)
    try {
      await fetchJson("/api/receptionists", { method: "POST", body: { name: receptionistName.trim(), phone: receptionistPhone.trim() } })
      setAddedReceptionist(true)
    } catch (e) {
      setNumberError(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAddingReceptionist(false)
    }
  }

  async function handleLaunch() {
    setNumberError("")
    setLaunching(true)
    try {
      await fetchJson("/api/routing", {
        method: "PUT",
        body: {
          fallback_type: aiEnabled ? "ai" : "owner",
          ai_greeting: aiEnabled ? aiGreeting : undefined,
        },
      })
      onComplete()
    } catch (e) {
      setNumberError(e instanceof Error ? e.message : "Failed to save")
      setLaunching(false)
    }
  }

  const canProceedStep1 =
    (numberMethod === "buy" && selectedNumber) ||
    (numberMethod === "port" && portNumber && portCarrier)

  async function handleStep1Continue() {
    if (!canProceedStep1) return
    setNumberError("")
    setStep1Submitting(true)
    try {
      if (numberMethod === "buy") {
        await fetchJson("/api/numbers/buy", { method: "POST", body: { phone_number: selectedRaw } })
      } else {
        await fetchJson("/api/numbers/port", { method: "POST", body: { number: portNumber, current_carrier: portCarrier } })
      }
      setStep(2)
    } catch (e) {
      setNumberError(e instanceof Error ? e.message : "Failed")
    } finally {
      setStep1Submitting(false)
    }
  }

  const totalSteps = 3

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Phone className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">Zing</span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-8 rounded-full transition-colors",
                  i + 1 <= step ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {step} of {totalSteps}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-8">
        <div className="w-full max-w-lg">

          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Get your business number</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  This is the number your customers will call. Buy a new one or bring your own.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setNumberMethod("buy"); setShowResults(false); setSelectedNumber("") }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                    numberMethod === "buy"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  <Plus className={cn("h-5 w-5", numberMethod === "buy" ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", numberMethod === "buy" ? "text-primary" : "text-foreground")}>
                    Buy New
                  </span>
                  <span className="text-[11px] text-muted-foreground">Get a fresh number</span>
                </button>
                <button
                  onClick={() => { setNumberMethod("port"); setShowResults(false); setSelectedNumber("") }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                    numberMethod === "port"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  <ArrowRightLeft className={cn("h-5 w-5", numberMethod === "port" ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", numberMethod === "port" ? "text-primary" : "text-foreground")}>
                    Port Existing
                  </span>
                  <span className="text-[11px] text-muted-foreground">Keep your number</span>
                </button>
              </div>

              {numberMethod === "buy" && (
                <div className="flex flex-col gap-4">
                  {!showResults ? (
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-semibold text-muted-foreground">Search by Area Code</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="e.g. 305, 212, 415"
                            maxLength={3}
                            value={areaCode}
                            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleSearch}
                          disabled={areaCode.length < 3}
                          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                        >
                          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Available in ({areaCode})</p>
                        <button
                          onClick={() => { setShowResults(false); setSelectedNumber("") }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Change
                        </button>
                      </div>
                      {availableNumbers.map((num) => (
                        <button
                          key={num.raw}
                          onClick={() => { setSelectedNumber(num.number); setSelectedRaw(num.raw) }}
                          className={cn(
                            "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                            selectedNumber === num.number
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/30"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{num.number}</p>
                            <p className="text-[11px] text-muted-foreground">{num.type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{num.price}</span>
                            {selectedNumber === num.number && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {numberMethod === "port" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2.5 rounded-xl bg-card p-4">
                    <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Port your existing business number to Zing. Takes 24-48 hours with zero downtime.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={portNumber}
                      onChange={(e) => setPortNumber(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Current Carrier</label>
                    <input
                      type="text"
                      placeholder="e.g. AT&T, Verizon, T-Mobile"
                      value={portCarrier}
                      onChange={(e) => setPortCarrier(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {numberError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{numberError}</p>
              )}
              <button
                onClick={handleStep1Continue}
                disabled={!canProceedStep1 || step1Submitting}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {step1Submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                {!step1Submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Add a receptionist</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add someone who answers calls for your business. You can skip this and do it later.
                </p>
              </div>

              {!addedReceptionist ? (
                <div className="flex flex-col gap-4">
                  {numberError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{numberError}</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Name</label>
                    <input
                      type="text"
                      placeholder="Sarah Miller"
                      value={receptionistName}
                      onChange={(e) => setReceptionistName(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="(555) 234-5678"
                      value={receptionistPhone}
                      onChange={(e) => setReceptionistPhone(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Pay Rate (per minute)</label>
                    <input
                      type="text"
                      placeholder="$0.50"
                      value={receptionistRate}
                      onChange={(e) => setReceptionistRate(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddReceptionist}
                    disabled={!receptionistName.trim() || !receptionistPhone.trim() || addingReceptionist}
                    className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                  >
                    {addingReceptionist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Receptionist
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {receptionistName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{receptionistName}</p>
                      <p className="text-xs text-muted-foreground">{receptionistPhone} &middot; {receptionistRate}/min</p>
                    </div>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip for Now
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Set up AI fallback</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  When no one answers, AI can pick up, greet callers, and take messages for you.
                </p>
              </div>

              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4 transition-all",
                  aiEnabled ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    aiEnabled ? "bg-primary/10" : "bg-secondary"
                  )}>
                    <Sparkles className={cn("h-5 w-5", aiEnabled ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">AI Assistant</p>
                    <p className="text-[11px] text-muted-foreground">Answers missed calls automatically</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "relative flex h-7 w-12 items-center rounded-full px-0.5 transition-all",
                    aiEnabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full shadow-sm transition-all",
                      aiEnabled ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-background"
                    )}
                  />
                </div>
              </button>

              {aiEnabled && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">AI Greeting Script</label>
                  <textarea
                    value={aiGreeting}
                    onChange={(e) => setAiGreeting(e.target.value)}
                    rows={4}
                    className="resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["Take messages", "Share hours", "Book appointments", "Answer FAQs"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {numberError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{numberError}</p>
              )}
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Launch My Business Line"}
                {!launching && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
