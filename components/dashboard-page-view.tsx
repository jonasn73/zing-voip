"use client"

import { memo, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export const DashboardPageView = memo(function DashboardPageView({
  children,
  animateEnter = false,
}: {
  children: ReactNode
  pathname?: string
  animateEnter?: boolean
}) {
  return (
    <div
      className={cn(
        "min-h-[calc(100dvh-7.5rem)] w-full bg-background px-5 pb-28 pt-5 sm:px-8 sm:pb-32 sm:pt-8",
        animateEnter && "animate-sigo-page-enter"
      )}
    >
      {children}
    </div>
  )
})
