"use client"

import dynamic from "next/dynamic"
import { type RefObject, useState } from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { LayoutGrid, Map as MapIcon, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ActivePipelinePanelStream } from "@/components/scheduler/active-pipeline-panel-stream"
import { DispatchOperationsMetricStrip } from "@/components/scheduler/dispatch-operations-metric-strip"
import type { SchedulerRouteMapHandle } from "@/components/scheduler-route-map"
import type {
  ActivePipelineJob,
  SchedulerEvent,
  TechLiveLocation,
  UnassignedPoolJob,
} from "@/lib/types"

const MapLoadingSkeleton = () => (
  <div className="absolute inset-0 animate-pulse bg-zinc-950/80" aria-hidden />
)

const SchedulerRouteMap = dynamic(
  () => import("@/components/scheduler-route-map").then((m) => ({ default: m.SchedulerRouteMap })),
  { ssr: false, loading: MapLoadingSkeleton }
)

const SHEET_SNAP_POINTS = ["45%", "85%"] as const

export type SchedulerMobileDispatchShellProps = {
  mapRef: RefObject<SchedulerRouteMapHandle | null>
  dayEvents: SchedulerEvent[]
  activePipelineJobs: ActivePipelineJob[]
  poolJobs: UnassignedPoolJob[]
  techLocations: TechLiveLocation[]
  selectedDayLabel: string
  selectedDay: Date
  highlightId: string | null
  pipelineDayKey: string
  useStreamedPipeline: boolean
  viewMode: "grid" | "map"
  onViewModeChange: (mode: "grid" | "map") => void
  onCreate: () => void
  onFocusJob: (job: ActivePipelineJob) => void
  onSelectEvent: (event: SchedulerEvent) => void
  onSelectPoolJob: (job: UnassignedPoolJob | ActivePipelineJob) => void
}

/** Mobile dispatch — full-bleed map with a draggable vaul bottom sheet for the job list. */
export function SchedulerMobileDispatchShell({
  mapRef,
  dayEvents,
  activePipelineJobs,
  poolJobs,
  techLocations,
  selectedDayLabel,
  selectedDay,
  highlightId,
  pipelineDayKey,
  useStreamedPipeline,
  viewMode,
  onViewModeChange,
  onCreate,
  onFocusJob,
  onSelectEvent,
  onSelectPoolJob,
}: SchedulerMobileDispatchShellProps) {
  const [sheetSnap, setSheetSnap] = useState<string | number | null>(SHEET_SNAP_POINTS[0])

  return (
    <div
      className="fixed inset-x-0 z-30 overflow-hidden md:hidden"
      style={{
        top: "3.5rem",
        bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
      }}
      data-scheduler-mobile-map=""
    >
      <div className="absolute inset-0 z-0 h-full w-full">
        <SchedulerRouteMap
          key="mobile-dispatch-map"
          ref={mapRef}
          events={dayEvents}
          pipelineJobs={activePipelineJobs}
          poolJobs={poolJobs}
          techLocations={techLocations}
          selectedDayLabel={selectedDayLabel}
          highlightId={highlightId}
          routeFocus={null}
          embedded
          mobileFullBleed
          disableHoverTooltips
          onSelectEvent={onSelectEvent}
          onSelectPoolJob={onSelectPoolJob}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2">
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/90 px-3 py-2 shadow-lg backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Dispatch</p>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Scheduler</h1>
          </div>
          <Button type="button" size="sm" className="shrink-0 gap-1" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Create
          </Button>
        </div>

        <div className="pointer-events-auto flex rounded-lg border border-border/70 bg-zinc-950/90 p-0.5 shadow-lg backdrop-blur-md">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "map" ? "default" : "ghost"}
            className="flex-1 gap-1 text-xs"
            onClick={() => onViewModeChange("map")}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden />
            Map
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            className="flex-1 gap-1 text-xs"
            onClick={() => onViewModeChange("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Grid
          </Button>
        </div>

        <div className="pointer-events-auto -mx-2">
          <DispatchOperationsMetricStrip
            poolJobs={poolJobs}
            activePipelineJobs={activePipelineJobs}
            dayEvents={dayEvents}
          />
        </div>
      </div>

      <DrawerPrimitive.Root
        open
        modal={false}
        dismissible={false}
        snapPoints={[...SHEET_SNAP_POINTS]}
        activeSnapPoint={sheetSnap}
        setActiveSnapPoint={setSheetSnap}
        fadeFromIndex={0}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Content
            className={cn(
              "fixed inset-x-0 z-40 flex flex-col outline-none",
              "border-t border-zinc-800 bg-zinc-950/95 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] backdrop-blur-md",
              "rounded-t-xl"
            )}
            style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              type="button"
              className="flex w-full shrink-0 flex-col items-center pt-3 pb-2"
              onClick={() =>
                setSheetSnap((prev) => (prev === SHEET_SNAP_POINTS[1] ? SHEET_SNAP_POINTS[0] : SHEET_SNAP_POINTS[1]))
              }
              aria-label={sheetSnap === SHEET_SNAP_POINTS[1] ? "Collapse job list" : "Expand job list"}
            >
              <div className="h-1 w-10 rounded-full bg-zinc-600" />
            </button>

            <div className="shrink-0 border-b border-zinc-800 px-4 pb-2">
              <h2 className="text-sm font-semibold text-foreground">
                {selectedDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {activePipelineJobs.length} active job{activePipelineJobs.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <ActivePipelinePanelStream
                dayKey={pipelineDayKey}
                useStreamedInitialDay={useStreamedPipeline}
                highlightId={highlightId}
                onFocusJob={onFocusJob}
                layout="mobileSheet"
              />
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </div>
  )
}
