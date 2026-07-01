"use client"

import { useEffect, useState } from "react"

/** Ticks every 30s so the dispatch clock stays current without heavy re-renders. */
export function useLiveClock(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}

/** Local wall-clock label for the scheduler status bar. */
export function formatSchedulerLiveClock(now: Date): string {
  return now.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
