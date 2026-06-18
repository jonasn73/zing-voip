"use client"

import { memo } from "react"
import { ChevronRight, Hash, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardNumbersModal } from "@/components/dashboard-numbers-modal-context"
import { useDashboardActivationOptional } from "@/components/dashboard-activation-context"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { LineRoutingStatus } from "@/components/line-routing-status"
import {
  businessNumbersMatch,
  formatPhoneDisplay,
  isDashboardVisibleLineStatus,
  type DashboardBusinessNumber,
} from "@/lib/dashboard-routing-utils"
import type { RoutingStrategy } from "@/lib/types"

export const DashboardRoutingSidebar = memo(function DashboardRoutingSidebar({
  lineCount,
  activeLineDisplay,
  routingStrategy,
  businessNumbers,
  className,
}: {
  lineCount: number
  // Formatted active business number (e.g. "(502) 555-1219") — null when no lines exist yet.
  activeLineDisplay: string | null
  // Drives the "Routing to Pool" status + the violet accent on the active-line card.
  routingStrategy: RoutingStrategy
  // Every visible business line so owners can see and tap each number (not just the active one).
  businessNumbers: DashboardBusinessNumber[]
  className?: string
}) {
  const { openBuyModal, openManageModal } = useDashboardNumbersModal()
  const { activeLine, setActiveLine } = useDashboardWorkspace()
  const activation = useDashboardActivationOptional()
  const subscriptionActive = activation?.subscriptionActive === true
  const lineCarrierLive = activation?.lineCarrierLive === true
  const poolRouting = routingStrategy === "lyncr_only"
  const visibleLines = businessNumbers.filter((b) => isDashboardVisibleLineStatus(b.status))

  return (
    <aside
      className={cn(
        "w-full shrink-0 lg:w-56 xl:w-60",
        "rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm ring-1 ring-border/40",
        className
      )}
      aria-label="Phone lines"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
          <Hash className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Phone lines</p>
          <p className="text-[11px] text-muted-foreground">
            {lineCount === 0 ? "No lines yet" : `${lineCount} active`}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={openBuyModal}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--electric-glow)] transition-[opacity,transform] hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" aria-hidden />
        + Add business number
      </button>

      {visibleLines.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Your business lines">
          {visibleLines.map((line) => {
            const isActive =
              activeLine != null && businessNumbersMatch(line.number, activeLine)
            const label = line.label?.trim() || "Business Line"
            return (
              <li key={line.number}>
                <button
                  type="button"
                  onClick={() => setActiveLine(line.number)}
                  className={cn(
                    "relative w-full rounded-xl border px-3 py-3 text-left transition-colors",
                    isActive
                      ? poolRouting
                        ? "border-violet-500/45 bg-violet-500/5 ring-1 ring-violet-500/15"
                        : "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                      : "border-border/70 bg-background/40 hover:border-primary/25 hover:bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isActive
                        ? poolRouting
                          ? "text-violet-300/85"
                          : "text-primary/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {formatPhoneDisplay(line.number)}
                  </p>
                  {line.status === "porting" ? (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-400/90">Transfer in progress</p>
                  ) : null}
                  {isActive ? (
                    <LineRoutingStatus
                      routingStrategy={routingStrategy}
                      subscriptionActive={subscriptionActive}
                      lineCarrierLive={lineCarrierLive}
                      className="mt-1"
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : activeLineDisplay ? (
        <div
          className={cn(
            "relative mt-4 rounded-xl border px-3 py-3 transition-colors",
            poolRouting
              ? "border-violet-500/45 bg-violet-500/5 ring-1 ring-violet-500/15"
              : "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
          )}
        >
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              poolRouting ? "text-violet-300/85" : "text-primary/80"
            )}
          >
            Active line
          </span>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{activeLineDisplay}</p>
          <LineRoutingStatus
            routingStrategy={routingStrategy}
            subscriptionActive={subscriptionActive}
            lineCarrierLive={lineCarrierLive}
            className="mt-1"
          />
        </div>
      ) : null}

      <nav className="mt-5 flex flex-col gap-1" aria-label="Number shortcuts">
        <button
          type="button"
          onClick={openManageModal}
          className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <span>Lines & numbers</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
        <button
          type="button"
          onClick={openBuyModal}
          className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <span>Buy / manage numbers</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
      </nav>
    </aside>
  )
})
