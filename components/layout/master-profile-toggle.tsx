"use client"

// Client-only header control for platform admins (is_platform_admin = true).

import { memo, useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { MasterToggleMode } from "@/lib/types"

const MODE_LABELS: { value: MasterToggleMode; label: string }[] = [
  { value: "tech", label: "Tech" },
  { value: "admin", label: "Admin" },
  { value: "passive", label: "Passive" },
]

export type MasterProfileToggleProps = {
  /** Starting mode from the server — only passed when the user is a platform admin. */
  initialMode: MasterToggleMode
  /** Dark operator console header — stronger selected-state contrast. */
  variant?: "default" | "admin"
}

/** Three-way switch: Tech (field alerts), Admin (silent metrics), Passive (exceptions only). */
export const MasterProfileToggle = memo(function MasterProfileToggle({
  initialMode,
  variant = "default",
}: MasterProfileToggleProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<MasterToggleMode>(initialMode)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const saveMode = useCallback(
    async (next: MasterToggleMode) => {
      if (busy) return
      const previous = mode
      setMode(next)
      setBusy(true)
      try {
        const res = await fetch("/api/admin/toggle-profile", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          data?: { master_toggle_mode?: MasterToggleMode }
        }
        if (!res.ok) throw new Error(json.error || "Could not save profile")
        const saved = json.data?.master_toggle_mode ?? next
        setMode(saved)
        toast({
          title: "Profile updated",
          description: `Notification mode set to ${saved}.`,
        })
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zing-master-toggle-mode-changed", { detail: { mode: saved } })
          )
        }
      } catch (e) {
        setMode(previous)
        toast({
          title: "Could not save profile",
          description: e instanceof Error ? e.message : "Try again in a moment.",
          variant: "destructive",
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, mode, toast]
  )

  const isAdminChrome = variant === "admin"

  return (
    <div
      className={cn(
        "flex max-w-[min(100%,20rem)] items-center gap-1 rounded-lg border px-1 py-0.5 shadow-sm",
        isAdminChrome
          ? "border-slate-700/80 bg-slate-900/60"
          : "border-border/70 bg-card/80",
        busy && "opacity-80"
      )}
      aria-label="Platform owner notification profile"
      title="Platform owner quick-toggle — controls global alerts"
    >
      {busy ? (
        <Loader2
          className={cn(
            "ml-1 h-3.5 w-3.5 shrink-0 animate-spin",
            isAdminChrome ? "text-slate-400" : "text-muted-foreground"
          )}
          aria-hidden
        />
      ) : null}
      <div className="flex w-full gap-0.5" role="group" aria-label="Notification profile mode">
        {MODE_LABELS.map(({ value, label }) => {
          const selected = mode === value
          return (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={selected ? "default" : "ghost"}
              disabled={busy}
              aria-pressed={selected}
              className={cn(
                "h-7 flex-1 px-2 text-[10px] sm:text-xs",
                isAdminChrome &&
                  (selected
                    ? "bg-violet-600 text-white hover:bg-violet-600"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white")
              )}
              onClick={() => {
                if (value !== mode) void saveMode(value)
              }}
            >
              {label}
            </Button>
          )
        })}
      </div>
    </div>
  )
})
