"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  WorkspacePanel,
  WorkspaceTableWrap,
  WorkspaceTh,
  WORKSPACE_TABLE_ROW_CLASS,
} from "@/components/dashboard-workspace-ui"

const SKELETON_BLOCK = "rounded-xl bg-zinc-900 sigo-skeleton-breathe"

/** GPU bloom wrapper for lists/cards after data is ready. */
export function WorkspaceBloom({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sigo-bloom-in", className)}>{children}</div>
}

function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn(SKELETON_BLOCK, className)} aria-hidden />
}

/** Step 2–4 call-flow cards — matches FlowStepCard min height. */
export function CallFlowStepsSkeleton() {
  return (
    <div
      className="flex min-h-[14.5rem] w-full flex-col gap-4 lg:flex-row lg:items-stretch"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn("min-h-[12.5rem] min-w-0 flex-1 rounded-2xl border border-border/40", SKELETON_BLOCK)}
        />
      ))}
    </div>
  )
}

export function CallFlowLinePickerSkeleton() {
  return (
    <div className={cn("mx-auto h-[5.25rem] w-full max-w-md", SKELETON_BLOCK)} aria-hidden />
  )
}

type TableSkeletonProps = {
  columns: { width: string; label: string }[]
  rows?: number
  panelClassName?: string
}

function TableSkeletonBody({ columns, rows = 6 }: TableSkeletonProps) {
  return (
    <WorkspaceTableWrap>
      <colgroup>
        {columns.map((col, i) => (
          <col key={i} className={col.width} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((col) => (
            <WorkspaceTh key={col.label}>{col.label}</WorkspaceTh>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i} className={WORKSPACE_TABLE_ROW_CLASS}>
            {columns.map((col) => (
              <td key={col.label} className="border-b border-zinc-800/50 px-4 py-3.5 align-middle">
                <SkeletonBar className="h-4 w-[70%] max-w-[10rem]" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </WorkspaceTableWrap>
  )
}

export function ActivityTableSkeleton() {
  return (
    <WorkspacePanel className="min-h-[380px]">
      <TableSkeletonBody
        columns={[
          { width: "w-[22%]", label: "Status" },
          { width: "w-[30%]", label: "Caller" },
          { width: "w-[14%]", label: "Duration" },
          { width: "w-[24%]", label: "Target line" },
          { width: "w-[10%]", label: " " },
        ]}
        rows={6}
      />
    </WorkspacePanel>
  )
}

export function PayStatCardsSkeleton() {
  return (
    <div className="grid min-h-[5.75rem] gap-4 sm:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("min-h-[5.75rem] rounded-2xl border border-zinc-800/60", SKELETON_BLOCK)} />
      ))}
    </div>
  )
}

export function PayLedgerSkeleton() {
  return (
    <WorkspacePanel className="min-h-[300px]">
      <div className="border-b border-zinc-800 px-5 py-4">
        <SkeletonBar className="h-4 w-32" />
      </div>
      <TableSkeletonBody
        columns={[
          { width: "w-[40%]", label: "Date" },
          { width: "w-[35%]", label: "Amount" },
          { width: "w-[25%]", label: " " },
        ]}
        rows={4}
      />
    </WorkspacePanel>
  )
}
