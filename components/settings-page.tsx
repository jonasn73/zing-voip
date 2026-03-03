"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Moon,
  Bell,
  Clock,
  Voicemail,
  Shield,
  ChevronRight,
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
import { fetcher, fetchJson } from "@/lib/fetcher"
import { formatPhone } from "@/lib/utils"

interface SettingToggle {
  id: string
  label: string
  description: string
  icon: typeof Moon
  enabled: boolean
  iconColor: string
}

export function SettingsPage() {
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
  const [portSuccessMessage, setPortSuccessMessage] = useState("")
  // Full port form (for non-Twilio carriers) — LOA fields + utility bill
  const [portCustomerType, setPortCustomerType] = useState<"Business" | "Individual">("Business")
  const [portCustomerName, setPortCustomerName] = useState("")
  const [portAccountNumber, setPortAccountNumber] = useState("")
  const [portAccountPhone, setPortAccountPhone] = useState("")
  const [portAuthRep, setPortAuthRep] = useState("")
  const [portAuthRepEmail, setPortAuthRepEmail] = useState("")
  const [portStreet, setPortStreet] = useState("")
  const [portStreet2, setPortStreet2] = useState("")
  const [portCity, setPortCity] = useState("")
  const [portState, setPortState] = useState("")
  const [portZip, setPortZip] = useState("")
  const [portCountry, setPortCountry] = useState("US")
  const [portPin, setPortPin] = useState("")
  const [portDocumentSid, setPortDocumentSid] = useState("")
  const [portDocumentFile, setPortDocumentFile] = useState<File | null>(null)
  const [portUploading, setPortUploading] = useState(false)
  const [selectedAreaCode, setSelectedAreaCode] = useState("")
  const [buyStep, setBuyStep] = useState<"search" | "results">("search")
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState("")

  const { data: sessionData } = useSWR<{ data: { user: { name: string; email: string } } }>("/api/auth/session", fetcher)
  const { data: numbersData, mutate: mutateNumbers } = useSWR<{ numbers: { id: string; number: string; friendly_name: string; label: string; type: string; status: string }[] }>("/api/numbers", fetcher)

  const user = sessionData?.data?.user
  const myNumbers = (numbersData?.numbers ?? []).map((n) => ({
    id: n.id,
    number: formatPhone(n.number),
    label: n.label,
    type: n.type,
    status: n.status as "active" | "pending" | "porting",
  }))

  async function handleSearchNumbers() {
    setBuyError("")
    setBuyLoading(true)
    try {
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ area_code: selectedAreaCode, type: "local" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Search failed")
      setAvailableNumbers((data as { numbers: { number: string; friendly_name: string; type: string }[] }).numbers.map((n) => ({
        raw: n.number,
        number: formatPhone(n.number),
        type: n.type === "local" ? "Local" : "Toll-Free",
        price: "$2.99/mo",
      })))
      setBuyStep("results")
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setBuyLoading(false)
    }
  }

  const [availableNumbers, setAvailableNumbers] = useState<{ raw: string; number: string; type: string; price: string }[]>([])

  async function handleBuyNumber(rawNumber: string) {
    setBuyError("")
    try {
      await fetchJson("/api/numbers/buy", { method: "POST", body: { phone_number: rawNumber } })
      mutateNumbers()
      setShowNumberModal(false)
      setBuyStep("search")
      setSelectedAreaCode("")
      setAvailableNumbers([])
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Purchase failed")
    }
  }

  async function handlePortSubmit() {
    setBuyError("")
    try {
      const carrierLower = portCarrier.trim().toLowerCase()
      const isTwilio = carrierLower === "twilio"
      // If other carrier and we have LOA + document, submit real Port In to Twilio
      const hasLoa =
        portCustomerName &&
        portAccountNumber &&
        portAccountPhone &&
        portAuthRep &&
        portAuthRepEmail &&
        portStreet &&
        portCity &&
        portState &&
        portZip &&
        portCountry
      const hasDoc = portDocumentSid.length > 0

      let body: Record<string, unknown> = { number: portNumber, current_carrier: portCarrier }
      if (!isTwilio && hasLoa && hasDoc) {
        body = {
          ...body,
          losing_carrier_information: {
            customer_type: portCustomerType,
            customer_name: portCustomerName,
            account_number: portAccountNumber,
            account_telephone_number: portAccountPhone,
            authorized_representative: portAuthRep,
            authorized_representative_email: portAuthRepEmail,
            address: {
              street: portStreet,
              street_2: portStreet2 || undefined,
              city: portCity,
              state: portState,
              zip: portZip,
              country: portCountry,
            },
          },
          document_sids: [portDocumentSid],
          pin: portPin || undefined,
        }
      }

      const res = await fetch("/api/numbers/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Port request failed")
      setPortSuccessMessage((data as { message?: string }).message ?? "Port request received.")
      setPortSubmitted(true)
      mutateNumbers()
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Port request failed")
    }
  }

  async function handlePortDocumentUpload() {
    if (!portDocumentFile) return
    setPortUploading(true)
    setBuyError("")
    try {
      const form = new FormData()
      form.append("file", portDocumentFile)
      const res = await fetch("/api/numbers/upload-port-document", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed")
      setPortDocumentSid((data as { document_sid?: string }).document_sid ?? "")
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setPortUploading(false)
    }
  }

  function toggleSetting(id: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-8">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
            {user?.name?.slice(0, 2).toUpperCase() ?? "ME"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">{user?.name ?? "My Business"}</p>
          <p className="text-sm text-muted-foreground">{user?.email ?? "—"}</p>
          <Badge variant="secondary" className="mt-1 text-[10px]">
            Pro Plan
          </Badge>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>

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

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Phone Numbers
        </h3>
        <div className="flex flex-col gap-2">
          {myNumbers.map((num) => (
            <div
              key={num.id}
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
              {num.status === "porting" ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Porting in progress
                </span>
              ) : (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Active
                </span>
              )}
            </div>
          ))}

          <button
            onClick={() => { setShowNumberModal(true); setNumberTab("buy"); setBuyStep("search"); setSelectedAreaCode(""); setPortSubmitted(false); setPortSuccessMessage(""); setPortNumber(""); setPortCarrier(""); setPortCustomerType("Business"); setPortCustomerName(""); setPortAccountNumber(""); setPortAccountPhone(""); setPortAuthRep(""); setPortAuthRepEmail(""); setPortStreet(""); setPortStreet2(""); setPortCity(""); setPortState(""); setPortZip(""); setPortCountry("US"); setPortPin(""); setPortDocumentSid(""); setPortDocumentFile(null); }}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-all hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Get a Number</p>
                <p className="text-xs text-muted-foreground">Buy new or port existing</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary/60" />
          </button>
        </div>
      </section>

      {showNumberModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setShowNumberModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
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
                  <>
                    {buyError && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{buyError}</p>
                    )}
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
                        key={num.raw}
                        onClick={() => handleBuyNumber(num.raw)}
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
                  </>
                )}
              </div>
            )}

            {numberTab === "port" && (
              <div className="p-4">
                {portSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <Check className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Number added</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {portSuccessMessage || "You'll see it in Settings. We configure everything—no Twilio setup needed."}
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
                        Port your existing business number. If it's already on Twilio, we'll connect it in-app. From other carriers, add your account details below to start the transfer—we'll send you a form to sign (LOA) and then your number will move in 1–2 business days.
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
                      <label className="text-[11px] font-semibold text-muted-foreground">Current Carrier</label>
                      <input
                        type="text"
                        placeholder="e.g. AT&T, Verizon, T-Mobile, Twilio"
                        value={portCarrier}
                        onChange={(e) => setPortCarrier(e.target.value)}
                        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    {/* Full port form when carrier is not Twilio */}
                    {portCarrier.trim() && portCarrier.trim().toLowerCase() !== "twilio" && (
                      <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-3">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Account details (required by your carrier to release the number)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="radio"
                              name="portCustomerType"
                              checked={portCustomerType === "Business"}
                              onChange={() => setPortCustomerType("Business")}
                              className="rounded border-border"
                            />
                            Business
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="radio"
                              name="portCustomerType"
                              checked={portCustomerType === "Individual"}
                              onChange={() => setPortCustomerType("Individual")}
                              className="rounded border-border"
                            />
                            Individual
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Customer name (on bill)</label>
                          <input
                            type="text"
                            placeholder={portCustomerType === "Business" ? "Company name" : "Full name"}
                            value={portCustomerName}
                            onChange={(e) => setPortCustomerName(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Account number</label>
                          <input
                            type="text"
                            placeholder="From your current carrier bill"
                            value={portAccountNumber}
                            onChange={(e) => setPortAccountNumber(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Account phone number</label>
                          <input
                            type="tel"
                            placeholder="Main number on the account"
                            value={portAccountPhone}
                            onChange={(e) => setPortAccountPhone(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Authorized representative (name)</label>
                          <input
                            type="text"
                            placeholder="Person who can sign the LOA"
                            value={portAuthRep}
                            onChange={(e) => setPortAuthRep(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Authorized rep email (for LOA signature)</label>
                          <input
                            type="email"
                            placeholder="email@example.com"
                            value={portAuthRepEmail}
                            onChange={(e) => setPortAuthRepEmail(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Billing address</label>
                          <input
                            type="text"
                            placeholder="Street"
                            value={portStreet}
                            onChange={(e) => setPortStreet(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Apt, suite (optional)"
                            value={portStreet2}
                            onChange={(e) => setPortStreet2(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="City"
                              value={portCity}
                              onChange={(e) => setPortCity(e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="State"
                              value={portState}
                              onChange={(e) => setPortState(e.target.value)}
                              className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="ZIP"
                              value={portZip}
                              onChange={(e) => setPortZip(e.target.value)}
                              className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Country"
                            value={portCountry}
                            onChange={(e) => setPortCountry(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">PIN (if mobile)</label>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={portPin}
                            onChange={(e) => setPortPin(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Utility bill (PDF or image, &lt;10MB)</label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                setPortDocumentFile(f ?? null)
                                if (!f) setPortDocumentSid("")
                              }}
                              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:text-primary-foreground"
                            />
                            <button
                              type="button"
                              onClick={handlePortDocumentUpload}
                              disabled={!portDocumentFile || portUploading}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                            >
                              {portUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Upload"}
                            </button>
                          </div>
                          {portDocumentSid && (
                            <p className="text-[11px] text-success">Document uploaded. You can submit the port request.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {buyError && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{buyError}</p>
                    )}
                    <button
                      onClick={handlePortSubmit}
                      disabled={!portNumber || !portCarrier}
                      className="mt-1 w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                      Submit Port Request
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h3>
        <div className="flex flex-col gap-2">
          {process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? (
            <a
              href={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
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
          ) : (
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
          )}

          {process.env.NEXT_PUBLIC_SUPPORT_URL ? (
            <a
              href={process.env.NEXT_PUBLIC_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
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
          ) : (
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
          )}

          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
              window.location.href = "/"
            }}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-destructive/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive">Sign Out</p>
            </div>
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Zing v1.0.0
      </p>
    </div>
  )
}
