"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { DEFAULT_BUSY_GENERIC } from "@/lib/ai-intake-defaults" // Default opening line for the voice AI (high-volume tone, not "we're closed")
import {
  buildOnboardingNumberInventory,
  type OnboardingNumberOption,
} from "@/lib/onboarding-number-inventory"
import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/brand-mark"
import { BrandWordmark } from "@/components/brand-wordmark"
import { SITE_NAME } from "@/lib/brand"
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet"
import { StorySheetHeader } from "@/components/story-sheet-header"
import { getAppSheetStory } from "@/components/app-sheet-stories"
import { SheetInfoTrigger } from "@/components/sheet-info-trigger"
import {
  ArrowRight,
  ArrowRightLeft,
  Hash,
  Loader2,
  Check,
  Plus,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react"

const INVENTORY_REFRESH_MS = 300
/** Locks list height so Continue row does not jump when numbers refresh (4 × ~3.5rem rows + gaps). */
const ONBOARDING_NUMBER_LIST_MIN_H = "min-h-[17.75rem]"

interface OnboardingPageProps {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [onboardingSheetKey, setOnboardingSheetKey] = useState<string | null>(null)

  // Step 1 -- Get a number
  const [numberMethod, setNumberMethod] = useState<"buy" | "port" | null>(null)
  const [areaCode, setAreaCode] = useState("")
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState("")
  const [inventoryNumbers, setInventoryNumbers] = useState<OnboardingNumberOption[]>(() =>
    buildOnboardingNumberInventory("502")
  )
  const [refreshingInventory, setRefreshingInventory] = useState(false)
  const [portNumber, setPortNumber] = useState("")
  const [portCarrier, setPortCarrier] = useState("")

  // Step 2 -- Add first receptionist (optional)
  const [receptionistName, setReceptionistName] = useState("")
  const [receptionistPhone, setReceptionistPhone] = useState("")
  const [receptionistRate, setReceptionistRate] = useState("")
  const [addedReceptionist, setAddedReceptionist] = useState(false)

  // Step 3 -- Configure AI fallback
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiGreeting, setAiGreeting] = useState(DEFAULT_BUSY_GENERIC) // Same default as dashboard / AI flow

  const refreshInventory = useCallback(() => {
    if (refreshingInventory || areaCode.length < 3) return
    setRefreshingInventory(true)
    window.setTimeout(() => {
      const next = buildOnboardingNumberInventory(areaCode)
      setInventoryNumbers(next)
      setSelectedNumber((prev) => (next.some((n) => n.number === prev) ? prev : ""))
      setRefreshingInventory(false)
    }, INVENTORY_REFRESH_MS)
  }, [areaCode, refreshingInventory])

  function handleSearch() {
    const ac = areaCode.replace(/\D/g, "").slice(0, 3)
    if (ac.length < 3) return
    setSearching(true)
    setSelectedNumber("")
    window.setTimeout(() => {
      setInventoryNumbers(buildOnboardingNumberInventory(ac))
      setSearching(false)
      setShowResults(true)
    }, 800)
  }

  function handleAddReceptionist() {
    setAddedReceptionist(true)
  }

  const canProceedStep1 =
    (numberMethod === "buy" && selectedNumber) ||
    (numberMethod === "port" && portNumber && portCarrier)

  const canProceedStep2 = true // optional step

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with progress */}
      <header className="border-b border-border px-6 py-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <BrandMark className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <BrandWordmark size="sm" />
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
            <SheetInfoTrigger
              onPress={() => setOnboardingSheetKey("onboarding-overview")}
              label="About this setup wizard"
              className="h-8 w-8"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {step} of {totalSteps}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center px-6 py-8">
        <div className="w-full max-w-lg">

          {/* Step 1: Get a number */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Add your business number</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  The number customers will call. Buy new or port existing. Calls route to your cell (or receptionists).
                </p>
              </div>

              {/* Method selector */}
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

              {/* Buy flow */}
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Available in ({areaCode})</p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={refreshingInventory}
                            onClick={refreshInventory}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-semibold text-primary",
                              "transition-[opacity,transform] duration-200",
                              "hover:scale-[1.03] hover:opacity-90 active:scale-[0.98]",
                              "disabled:pointer-events-none disabled:opacity-40"
                            )}
                          >
                            <RefreshCw
                              className={cn("h-3 w-3", refreshingInventory && "animate-spin")}
                              aria-hidden
                            />
                            ↻ Refresh options
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowResults(false)
                              setSelectedNumber("")
                            }}
                            className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className={cn("relative", ONBOARDING_NUMBER_LIST_MIN_H)}>
                        <div
                          className={cn(
                            "flex flex-col gap-3 transition-[opacity,transform] duration-300",
                            refreshingInventory && "pointer-events-none scale-[0.985] opacity-40"
                          )}
                        >
                      {inventoryNumbers.map((num) => (
                        <button
                          key={num.id}
                          type="button"
                          onClick={() => setSelectedNumber(num.number)}
                          className={cn(
                            "flex h-[3.5rem] shrink-0 items-center justify-between rounded-xl border p-3.5 text-left transition-[border-color,background-color]",
                            selectedNumber === num.number
                              ? "border-primary bg-primary/5 shadow-[0_0_20px_-10px_var(--primary)]"
                              : "border-border bg-card hover:border-primary/30"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium tabular-nums text-foreground">{num.number}</p>
                            <p className="text-[11px] text-muted-foreground">{num.type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{num.price}</span>
                            {selectedNumber === num.number ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            ) : (
                              <span className="h-5 w-5 shrink-0" aria-hidden />
                            )}
                          </div>
                        </button>
                      ))}
                        </div>
                        {refreshingInventory ? (
                          <div
                            className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                            aria-hidden
                          >
                            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Port flow */}
              {numberMethod === "port" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2.5 rounded-xl bg-card p-4">
                    <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Port your existing business number to {SITE_NAME}. Takes 24-48 hours with zero downtime.
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

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2: Add first receptionist */}
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
                    disabled={!receptionistName || !receptionistPhone}
                    className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
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

          {/* Step 3: AI fallback */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Set up AI fallback</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  When nobody picks up, your AI receptionist answers with a script for your trade, captures job details, and can text you leads.
                </p>
              </div>

              {/* Toggle */}
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
                    <p className="text-sm font-semibold text-foreground">AI receptionist</p>
                    <p className="text-[11px] text-muted-foreground">Voice AI for missed calls — industry intake and lead capture</p>
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

              {/* Greeting editor */}
              {aiEnabled && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">Opening line (first thing AI says)</label>
                  <textarea
                    value={aiGreeting}
                    onChange={(e) => setAiGreeting(e.target.value)}
                    rows={4}
                    className="resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Industry-smart intake",
                      "Lead capture",
                      "Optional SMS to your cell",
                      "Business hours",
                    ].map((tag) => (
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

              <button
                onClick={onComplete}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Launch My Business Line
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      <Sheet open={onboardingSheetKey != null} onOpenChange={(open) => !open && setOnboardingSheetKey(null)} modal>
        <SheetContent side="bottom" className="gap-0 p-0 sm:mx-auto sm:max-w-lg [&>button]:top-3">
          {(() => {
            const story = onboardingSheetKey ? getAppSheetStory(onboardingSheetKey) : null
            if (!onboardingSheetKey || !story) return null
            return (
              <>
                <StorySheetHeader {...story} />
                <div className="border-t border-border/60 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    When you finish, open{" "}
                    <Link href="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">
                      Call console
                    </Link>{" "}
                    for live routing.
                  </p>
                </div>
                <SheetFooter className="border-t border-border/70 bg-secondary/15 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground">Demo steps here may not call real Telnyx APIs until you add numbers in Settings.</p>
                </SheetFooter>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
