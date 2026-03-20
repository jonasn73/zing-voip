"use client"

// ============================================
// Animated wrapper for each dashboard tab’s content
// ============================================
// `key={pathname}` remounts this subtree on navigation so enter motion runs every time.
// `motion-reduce` users get an instant paint (no animation) for accessibility.

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DashboardPageView({
  pathname,
  children,
}: {
  pathname: string
  children: ReactNode
}) {
  return (
    <div
      key={pathname}
      className={cn(
        "min-h-full bg-background",
        // Enter: fade + slight rise + soft zoom (tw-animate-css utilities)
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-3 motion-safe:duration-300 motion-safe:ease-out"
      )}
    >
      {children}
    </div>
  )
}
