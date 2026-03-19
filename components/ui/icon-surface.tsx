"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function IconSurface({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode
  className?: string
  tone?: "default" | "primary" | "success" | "warning" | "danger"
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
      ? "bg-warning/10 text-warning"
      : tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : "bg-secondary text-muted-foreground"

  return (
    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClass, className)}>
      {children}
    </div>
  )
}
