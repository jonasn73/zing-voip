"use client"

import { useCallback, useState } from "react"
import { Headphones, Loader2, RadioTower } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type RunCallQualityTestButtonProps = {
  /** Active business line E.164 — used as outbound caller ID for the test call. */
  businessNumber: string
  /** Hide when the carrier line is not live yet. */
  disabled?: boolean
  className?: string
}

/** Dashboard control — dials the signed-in owner's cell and runs the TeXML audio test line. */
export function RunCallQualityTestButton({
  businessNumber,
  disabled = false,
  className,
}: RunCallQualityTestButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const runTest = useCallback(async () => {
    if (loading || disabled || !businessNumber.trim()) return
    setLoading(true)
    toast({
      title: "Initiating Lyncr audio test line…",
      description: "Check your mobile device — we are placing a short diagnostic call.",
    })

    try {
      const res = await fetch("/api/voice/test-echo/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ business_number: businessNumber.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: { message?: string }
      }

      if (!res.ok) {
        toast({
          title: "Audio test could not start",
          description: String(data.error || "Try again in a moment."),
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Audio test call queued",
        description:
          data.data?.message ||
          "Answer your phone, speak after the tone, and listen for your recording played back twice.",
      })
    } catch {
      toast({
        title: "Audio test could not start",
        description: "Network error — check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [businessNumber, disabled, loading, toast])

  return (
    <button
      type="button"
      onClick={() => void runTest()}
      disabled={disabled || loading || !businessNumber.trim()}
      aria-busy={loading}
      className={cn(
        "group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary",
        "transition-[border-color,background-color,box-shadow,opacity] duration-200",
        "hover:border-primary/70 hover:bg-primary/15 hover:shadow-[0_0_24px_-8px_var(--primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <RadioTower className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden />
      )}
      <span>{loading ? "Calling your phone…" : "Run Call Quality Test"}</span>
      {!loading ? <Headphones className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : null}
    </button>
  )
}
