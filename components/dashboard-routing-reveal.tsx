"use client"

import type { ReactNode } from "react"

/** Wrapper for streamed dashboard main — no extra fade (skeleton → content is enough). */
export function DashboardRoutingReveal({ children }: { children: ReactNode }) {
  return <>{children}</>
}
