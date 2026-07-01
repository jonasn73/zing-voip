"use client"

import { useCallback, useState } from "react"
import type { SchedulerEvent } from "@/lib/types"

/** PATCH job status to completed from dispatch list chips / cards. */
export function useMarkJobComplete(onCompleted?: (event: SchedulerEvent) => void) {
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const markComplete = useCallback(
    async (jobId: string) => {
      if (!jobId || completingId) return false
      setCompletingId(jobId)
      setError(null)
      try {
        const res = await fetch(`/api/owner/jobs/${encodeURIComponent(jobId)}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        })
        const json = (await res.json()) as { error?: string; data?: { event?: SchedulerEvent } }
        if (!res.ok) throw new Error(json.error ?? "Could not mark job done")
        const event = json.data?.event
        if (event) onCompleted?.(event)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not mark job done")
        return false
      } finally {
        setCompletingId(null)
      }
    },
    [completingId, onCompleted]
  )

  return { markComplete, completingId, error, clearError: () => setError(null) }
}
