"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Soft fade-up when streamed dashboard content replaces the skeleton. */
export function DashboardRoutingReveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("sigo-dashboard-enter", className)}>{children}</div>
}
