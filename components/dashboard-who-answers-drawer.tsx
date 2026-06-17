"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Network, Plus, User } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { submitFormEvent } from "@/lib/form-keyboard"
import { openTeamInviteModal } from "@/lib/team-invite-events"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  DrawerScrollBody,
  DrawerStepHeader,
  DrawerStickyFooter,
} from "@/components/dashboard-routing-drawer-shared"
import { formatPhoneDisplay, type Contact } from "@/lib/dashboard-routing-utils"
import type { RoutingStrategy } from "@/lib/types"

// "pool" = route this line to the shared Lyncr Live Operator Pool (routing_strategy = 'lyncr_only').
type ReceiverId = "owner" | "pool" | string

type TeamRow = {
  id: ReceiverId
  name: string
  phone: string
  initials: string
  color?: string
  status: "active" | "forwarding" | "offline"
}

function statusBadge(status: TeamRow["status"]) {
  if (status === "active") {
    return (
      <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success shadow-[0_0_10px_-4px_var(--success)]">
        Active
      </span>
    )
  }
  if (status === "forwarding") {
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400/90">
        Forwarding
      </span>
    )
  }
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
      Offline
    </span>
  )
}

export type DashboardWhoAnswersDrawerProps = {
  receptionists: Contact[]
  selectedReceptionistId: string | null
  ownerPhoneDisplay: string
  saveRouting: (updates: Record<string, unknown>, opts?: { quiet?: boolean }) => Promise<void>
  onClose: () => void
  onRegisterDiscard?: (discard: () => void) => void
  routingBusinessNumber: string | null
  routingLineDetailLoading?: boolean
  // Opens the routing-strategy dialog on top of this drawer (private vs Lyncr network).
  onChangeRoutingStrategy?: () => void
  // Current hybrid-network strategy for this line; "lyncr_only" means the operator pool is active.
  routingStrategy: RoutingStrategy
  // Pushes the new strategy back to the dashboard canvas after a save.
  setRoutingStrategy: (s: RoutingStrategy) => void
}

export function DashboardWhoAnswersDrawer({
  receptionists,
  selectedReceptionistId,
  ownerPhoneDisplay,
  saveRouting,
  onClose,
  onRegisterDiscard,
  routingBusinessNumber,
  routingLineDetailLoading,
  onChangeRoutingStrategy,
  routingStrategy,
  setRoutingStrategy,
}: DashboardWhoAnswersDrawerProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  // Pool wins the initial selection when the line is set to "lyncr_only".
  const initialReceiver: ReceiverId = routingStrategy === "lyncr_only" ? "pool" : selectedReceptionistId ?? "owner"
  const [primaryId, setPrimaryId] = useState<ReceiverId>(initialReceiver)
  const baselineRef = useRef(initialReceiver)

  useEffect(() => {
    const next = routingStrategy === "lyncr_only" ? "pool" : selectedReceptionistId ?? "owner"
    setPrimaryId(next)
    baselineRef.current = next
  }, [selectedReceptionistId, routingStrategy])

  const dirty = primaryId !== baselineRef.current

  const rows: TeamRow[] = useMemo(() => {
    const ownerRow: TeamRow = {
      id: "owner",
      name: "Your Phone",
      phone: ownerPhoneDisplay,
      initials: "YO",
      status: primaryId === "owner" ? "active" : "offline",
    }
    const poolRow: TeamRow = {
      id: "pool",
      name: "Lyncr Live Operator Pool",
      phone: "Certified shared agents answer in-browser",
      initials: "LP",
      status: primaryId === "pool" ? "active" : "offline",
    }
    const teamRows: TeamRow[] = receptionists.map((c) => ({
      id: c.id,
      name: c.name,
      phone: formatPhoneDisplay(c.phone),
      initials: c.initials,
      color: c.color,
      status: primaryId === c.id ? "active" : "offline",
    }))
    return [ownerRow, poolRow, ...teamRows]
  }, [receptionists, ownerPhoneDisplay, primaryId])

  const lineLabel = routingBusinessNumber ? `Line ${formatPhoneDisplay(routingBusinessNumber)}` : null

  const discardEdits = useCallback(() => {
    setPrimaryId(baselineRef.current)
  }, [])

  useEffect(() => {
    onRegisterDiscard?.(discardEdits)
  }, [onRegisterDiscard, discardEdits])

  const handleCancel = useCallback(() => {
    discardEdits()
    onClose()
  }, [discardEdits, onClose])

  // Persist the per-line hybrid-network strategy via the parameterized /api/routing/strategy patch.
  const persistStrategy = useCallback(
    async (next: RoutingStrategy) => {
      const res = await fetch("/api/routing/strategy", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routing_strategy: next, business_number: routingBusinessNumber || null }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Failed to save routing strategy")
      }
    },
    [routingBusinessNumber]
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (primaryId === "pool") {
        // Flip this line onto the shared Lyncr Live Operator Pool (routing_strategy = 'lyncr_only').
        await persistStrategy("lyncr_only")
        setRoutingStrategy("lyncr_only")
      } else {
        // Owner / private receptionist: pick the ring target, and step off the pool if we were on it.
        await saveRouting({ selected_receptionist_id: primaryId === "owner" ? null : primaryId })
        if (routingStrategy === "lyncr_only") {
          await persistStrategy("private_only")
          setRoutingStrategy("private_only")
        }
      }
      baselineRef.current = primaryId
      toast({
        title: "Saved",
        description:
          primaryId === "pool"
            ? "Calls on this line now route to the Lyncr Live Operator Pool."
            : "Call destination updated for this line.",
      })
      onClose()
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [primaryId, routingStrategy, saveRouting, persistStrategy, setRoutingStrategy, onClose, toast])

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        submitFormEvent(e)
        if (!saving) void handleSave()
      }}
    >
      <DrawerStepHeader
        step="Step 2 · Call destination"
        title="Who Answers"
        subtitle="Manage which physical phones or team members ring when a call hits this line."
        lineLabel={lineLabel}
      />
      <DrawerScrollBody className={cn(routingLineDetailLoading && "pointer-events-none opacity-50")}>
        <div className="space-y-2" role="radiogroup" aria-label="Primary call destination">
          {rows.map((row) => {
            const selected = primaryId === row.id
            return (
              <button
                key={row.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPrimaryId(row.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color] duration-200",
                  selected
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_24px_-10px_var(--primary)]"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
                )}
              >
                {row.id === "owner" ? (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80">
                    <User className="h-5 w-5 text-zinc-300" aria-hidden />
                  </div>
                ) : row.id === "pool" ? (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                    <Network className="h-5 w-5 text-emerald-300" aria-hidden />
                  </div>
                ) : (
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarFallback className={cn(row.color, "text-xs font-semibold text-primary-foreground")}>
                      {row.initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.name}</p>
                    {row.id === "pool" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
                        Agents Available
                      </span>
                    ) : (
                      statusBadge(row.status)
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{row.phone}</p>
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                    selected ? "border-primary bg-primary shadow-[0_0_12px_-2px_var(--primary)]" : "border-zinc-600 bg-transparent"
                  )}
                  aria-hidden
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose()
            openTeamInviteModal()
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-transparent px-4 py-3 text-sm font-semibold text-zinc-400 transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add backup number
        </button>

        {receptionists.length === 0 ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
            No team members yet — add contacts on the Team tab, then pick who rings first here.
          </p>
        ) : null}

        {onChangeRoutingStrategy ? (
          <div className="mt-5 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={onChangeRoutingStrategy}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <Network className="h-3.5 w-3.5" aria-hidden />
              Change Routing Strategy
            </button>
            <p className="mt-1.5 text-center text-[11px] leading-relaxed text-zinc-600">
              Switch between your private team, the shared Lyncr network, or a hybrid fallback.
            </p>
          </div>
        ) : null}
      </DrawerScrollBody>
      <DrawerStickyFooter
        dirty={dirty}
        saving={saving}
        onSave={() => void handleSave()}
        onCancel={handleCancel}
        saveAsSubmit
      />
    </form>
  )
}
