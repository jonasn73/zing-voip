"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Phone, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import { fetchOnboardingProfile } from "@/lib/onboarding-profile-client"
import { formatBillingCycleDate } from "@/lib/format-billing-cycle"
import { dispatchBusinessNumbersChanged } from "@/components/dashboard-numbers-modal-context"
import { useToast } from "@/hooks/use-toast"

type OwnedLine = {
  id: string
  number: string
  status: string
  line_business_name?: string | null
}

export function ManageNumbersModal({
  open,
  onOpenChange,
  onBuyAnother,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBuyAnother?: () => void
}) {
  const { toast } = useToast()
  const [lines, setLines] = useState<OwnedLine[]>([])
  const [loading, setLoading] = useState(false)
  const [billingCycleEnd, setBillingCycleEnd] = useState<string | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<OwnedLine | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const loadLines = useCallback(() => {
    setLoading(true)
    void fetchOnboardingProfile()
      .then(({ profile }) => setBillingCycleEnd(profile?.billing_cycle_end?.trim() || null))
      .catch(() => setBillingCycleEnd(null))
    fetch("/api/numbers/mine", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { numbers: [] }))
      .then((data: { numbers?: { id?: string; number: string; status: string; label?: string }[] }) => {
        const rows = Array.isArray(data.numbers) ? data.numbers : []
        setLines(
          rows
            .filter((n) => n.status === "active")
            .map((n) => ({
              id: String(n.id),
              number: String(n.number),
              status: String(n.status),
              line_business_name: n.label?.trim() || null,
            }))
        )
      })
      .catch(() => setLines([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (open) loadLines()
  }, [open, loadLines])

  async function confirmRelease() {
    if (!releaseTarget) return
    setReleasingId(releaseTarget.id)
    try {
      const res = await fetch(`/api/numbers/${encodeURIComponent(releaseTarget.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string }
      if (!res.ok) {
        throw new Error(data.error || "Could not release this line")
      }
      toast({
        title: "Line released",
        description: `${formatPhoneDisplay(releaseTarget.number)} was returned to carrier inventory. Monthly billing for that line stops.`,
      })
      setReleaseTarget(null)
      loadLines()
      dispatchBusinessNumbersChanged()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not release line",
        description: e instanceof Error ? e.message : "Try again or contact support.",
      })
    } finally {
      setReleasingId(null)
    }
  }

  const canReleaseAny = lines.length > 1

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "sigo-marketplace-dialog gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md",
            "transform-gpu will-change-transform backface-hidden"
          )}
        >
          <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">Lines & numbers</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Published business numbers on your account. Release a line you no longer want — carrier credit is not
              refunded.
            </DialogDescription>
          </DialogHeader>

          {billingCycleEnd ? (
            <p className="border-b border-border/60 px-6 py-3 text-xs text-muted-foreground">
              Next billing date:{" "}
              <span className="font-medium text-foreground">{formatBillingCycleDate(billingCycleEnd)}</span>
            </p>
          ) : null}

          <div className="max-h-[min(55vh,24rem)] overflow-y-auto overscroll-contain px-6 py-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading lines" />
              </div>
            ) : lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-10 text-center text-sm text-zinc-500">
                No active lines yet. Buy a number to publish your first business line.
              </p>
            ) : (
              <ul className="space-y-3">
                {lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold tabular-nums text-foreground">{formatPhoneDisplay(line.number)}</p>
                      {line.line_business_name ? (
                        <p className="truncate text-xs text-zinc-500">{line.line_business_name}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Active
                      </span>
                      <button
                        type="button"
                        disabled={!canReleaseAny || releasingId != null}
                        onClick={() => setReleaseTarget(line)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 transition-colors hover:border-destructive/50 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          canReleaseAny
                            ? "Return this number to the carrier"
                            : "Buy another line first — you need at least one business number"
                        }
                      >
                        {releasingId === line.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3 w-3" aria-hidden />
                        )}
                        Release
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!canReleaseAny && lines.length === 1 ? (
            <p className="border-t border-border/60 px-6 py-3 text-xs text-muted-foreground">
              Your only line cannot be released. Add another number first if you want to swap to a different one.
            </p>
          ) : null}

          {onBuyAnother ? (
            <div className="border-t border-border/60 px-6 py-4">
              <button
                type="button"
                onClick={onBuyAnother}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--electric-glow)] transition-[opacity,transform] hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Buy another line
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={releaseTarget != null} onOpenChange={(next) => !next && setReleaseTarget(null)}>
        <AlertDialogContent className="border-border/60 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Release this line?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    {releaseTarget ? formatPhoneDisplay(releaseTarget.number) : ""}
                  </span>{" "}
                  will be removed from your account and returned to Telnyx inventory.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Callers will no longer reach you on this number.</li>
                  <li>Future monthly charges for this line stop.</li>
                  <li>The $2 carrier credit used to buy it is not refunded.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releasingId != null}>Keep line</AlertDialogCancel>
            <AlertDialogAction
              disabled={releasingId != null}
              onClick={(e) => {
                e.preventDefault()
                void confirmRelease()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releasingId ? "Releasing…" : "Release line"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
