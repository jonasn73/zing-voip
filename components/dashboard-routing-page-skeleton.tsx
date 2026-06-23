"use client"

import { Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { PhoneLinesSkeleton } from "@/components/dashboard/phone-lines-skeleton"
import {
  CallFlowLinePickerSkeleton,
  CallFlowStepsSkeleton,
} from "@/components/workspace-content-skeletons"
import { CALL_FLOW_STEPS_MIN_H } from "@/components/dashboard-workspace-ui"

/** Full /dashboard routing layout skeleton — matches sidebar + call flow structure. */
export function DashboardRoutingPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <aside
          className="w-full shrink-0 rounded-2xl border border-white/8 bg-neutral-950/50 p-4 shadow-sm ring-1 ring-white/5 backdrop-blur-md lg:w-56 xl:w-60"
          aria-busy="true"
          aria-label="Loading phone lines"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Hash className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Phone lines</p>
              <p className="text-[11px] text-muted-foreground">Loading…</p>
            </div>
          </div>
          <PhoneLinesSkeleton />
        </aside>

        <div className="min-w-0 flex-1">
          <section className="min-h-[22rem] overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-lg ring-1 ring-border/40">
            <header className="border-b border-border/50 bg-gradient-to-b from-muted/20 to-transparent px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-full max-w-xs sigo-skeleton-breathe rounded-xl bg-zinc-800/60" aria-hidden />
                <CallFlowLinePickerSkeleton />
              </div>
            </header>
            <div className={cn("px-4 py-6 sm:px-8 sm:py-8", CALL_FLOW_STEPS_MIN_H)}>
              <CallFlowStepsSkeleton />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
