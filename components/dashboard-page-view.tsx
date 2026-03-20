"use client"

// ============================================
// Animated wrapper for each dashboard tab’s content
// ============================================
// `key={pathname}` remounts this subtree on navigation so enter motion runs every time.
// `motion-reduce` users get an instant paint (no animation) for accessibility.

import { type ReactNode } from "react"

export function DashboardPageView({
  pathname,
  children,
}: {
  pathname: string
  children: ReactNode
}) {
  return (
    <div key={pathname} className="min-h-full bg-background">
      {children}
    </div>
  )
}
