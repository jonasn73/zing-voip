"use client"

import { useEffect, useState } from "react"
import { Bell, Clock, Loader2, LogOut, MessageSquare, Shield, Volume2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  DrawerStepHeader,
  DrawerScrollBody,
} from "@/components/dashboard-routing-drawer-shared"
import { useToast } from "@/hooks/use-toast"
import { signOutAndGoToLogin } from "@/lib/client-auth"
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspaceDisclosureRow,
  workspaceFieldClass,
  WORKSPACE_SHEET_CLASS,
} from "@/components/dashboard-workspace-ui"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
type DayHours = { open: string; close: string; enabled: boolean }
const DEFAULT_HOURS: Record<(typeof WEEKDAYS)[number], DayHours> = {
  Mon: { open: "09:00", close: "17:00", enabled: true },
  Tue: { open: "09:00", close: "17:00", enabled: true },
  Wed: { open: "09:00", close: "17:00", enabled: true },
  Thu: { open: "09:00", close: "17:00", enabled: true },
  Fri: { open: "09:00", close: "17:00", enabled: true },
  Sat: { open: "10:00", close: "14:00", enabled: false },
  Sun: { open: "10:00", close: "14:00", enabled: false },
}

export function SettingsWorkspaceView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [hours, setHours] = useState(DEFAULT_HOURS)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [businessNameSaving, setBusinessNameSaving] = useState(false)

  const [pushEnabled, setPushEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(true)
  const [whisperEnabled, setWhisperEnabled] = useState(true)
  const [whisperSaving, setWhisperSaving] = useState(false)

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        const u = data?.data?.user
        if (!u) return
        setName(String(u.name ?? ""))
        setEmail(String(u.email ?? ""))
        setBusinessName(String(u.business_name ?? "").trim() || "My Business")
        setWhisperEnabled(u.inbound_receptionist_whisper_enabled !== false)
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveBusinessName() {
    const trimmed = businessName.trim() || "My Business"
    setBusinessNameSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ business_name: trimmed }),
      })
      if (!res.ok) throw new Error("Save failed")
      setBusinessName(trimmed)
      toast({ title: "Saved" })
    } catch {
      toast({ title: "Could not save", variant: "destructive" })
    } finally {
      setBusinessNameSaving(false)
    }
  }

  async function saveWhisper(next: boolean) {
    setWhisperSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inbound_receptionist_whisper_enabled: next }),
      })
      if (!res.ok) throw new Error("Save failed")
      setWhisperEnabled(next)
    } catch {
      toast({ title: "Could not update", variant: "destructive" })
    } finally {
      setWhisperSaving(false)
    }
  }

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <WorkspacePage className="gap-10 pb-8">
      <WorkspacePageHeader eyebrow="Account" title="Settings" />

      <WorkspacePanel className="p-6 sm:p-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                {initials || "ME"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <p className="text-lg font-semibold text-foreground">{name || "Account"}</p>
                <p className="text-sm text-zinc-500">{email}</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Account business name
                </span>
                <input
                  className={workspaceFieldClass}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Key Squad 502"
                  maxLength={120}
                />
              </label>
              <button
                type="button"
                onClick={() => void saveBusinessName()}
                disabled={businessNameSaving || !businessName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {businessNameSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </WorkspacePanel>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">System</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleRow label="Push Notifications" icon={Bell} checked={pushEnabled} onChange={setPushEnabled} />
          <ToggleRow label="SMS Forwarding" icon={MessageSquare} checked={smsEnabled} onChange={setSmsEnabled} />
          <ToggleRow
            label="Team whisper after answer"
            icon={Volume2}
            checked={whisperEnabled}
            disabled={whisperSaving}
            onChange={(v) => void saveWhisper(v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Operations</p>
        <div className="flex flex-col gap-3">
          <WorkspaceDisclosureRow
            icon={<Clock className="h-5 w-5" />}
            label="Business Hours"
            onClick={() => setHoursOpen(true)}
          />
          <WorkspaceDisclosureRow
            icon={<Shield className="h-5 w-5" />}
            label="Security & Privacy"
            onClick={() => {
              const url = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || "/privacy"
              window.open(url, process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? "_blank" : "_self")
            }}
          />
          <WorkspaceDisclosureRow
            icon={<LogOut className="h-5 w-5" />}
            label={signingOut ? "Signing out…" : "Sign Out"}
            destructive
            onClick={() => {
              setSigningOut(true)
              void signOutAndGoToLogin().finally(() => setSigningOut(false))
            }}
          />
        </div>
      </section>

      <Sheet open={hoursOpen} onOpenChange={setHoursOpen} modal>
        <SheetContent side="right" className={WORKSPACE_SHEET_CLASS}>
          <DrawerStepHeader step="Schedule" title="Business Hours" subtitle="Weekly window" />
          <DrawerScrollBody>
            <ul className="flex flex-col gap-2">
              {WEEKDAYS.map((day) => {
                const row = hours[day]
                return (
                  <li
                    key={day}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5"
                  >
                    <label className="flex w-12 items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          setHours((prev) => ({ ...prev, [day]: { ...prev[day], enabled: e.target.checked } }))
                        }
                      />
                      {day}
                    </label>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.open}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))
                      }
                      className={workspaceFieldClass + " max-w-[7rem] py-1.5 text-xs disabled:opacity-40"}
                    />
                    <span className="text-xs text-zinc-600">–</span>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.close}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))
                      }
                      className={workspaceFieldClass + " max-w-[7rem] py-1.5 text-xs disabled:opacity-40"}
                    />
                  </li>
                )
              })}
            </ul>
          </DrawerScrollBody>
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  )
}

function ToggleRow({
  label,
  icon: Icon,
  checked,
  onChange,
  disabled,
}: {
  label: string
  icon: typeof Bell
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
      <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
