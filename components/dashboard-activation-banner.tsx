"use client"

import { memo } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardActivationOptional } from "@/components/dashboard-activation-context"

export const DashboardActivationBanner = memo(function DashboardActivationBanner() {
  const activation = useDashboardActivationOptional()
  if (!activation || activation.loading) {
    return null
  }

  if (activation.showProvisioningBanner) {
    return (
      <div
        className={cn(
          "shrink-0 border-b border-primary/35 bg-primary/10 backdrop-blur-sm",
          "px-4 py-2.5 sm:px-6 sm:py-3"
        )}
        role="status"
      >
        <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm leading-relaxed text-foreground/90 sm:justify-start sm:text-left">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          <span>
            Payment received — your line is not live yet. Add at least $2.00 carrier credit on the Pay tab if
            provisioning has not started.
          </span>
          <button
            type="button"
            disabled={activation.activating}
            onClick={() => void activation.requestLineActivation()}
            className={cn(
              "font-semibold text-primary underline decoration-primary/50 underline-offset-2",
              "hover:text-primary/90 disabled:opacity-60"
            )}
          >
            {activation.activating ? "Retrying…" : "Retry provisioning →"}
          </button>
        </p>
      </div>
    )
  }

  if (!activation.showTrialBanner) {
    return null
  }

  return (
    <div
      className={cn(
        "shrink-0 border-b border-amber-500/40 bg-amber-950/35 backdrop-blur-sm",
        "px-4 py-2.5 sm:px-6 sm:py-3"
      )}
      role="status"
    >
      <p className="mx-auto max-w-7xl text-center text-sm leading-relaxed text-foreground/90 sm:text-left">
        <span aria-hidden className="mr-1">
          ⚠️
        </span>
        Your business line is currently running in sandbox mode. Incoming calls will not route to live phones until
        your line is fully verified.{" "}
        <button
          type="button"
          disabled={activation.activating}
          onClick={() => void activation.requestLineActivation()}
          className={cn(
            "inline font-semibold text-amber-200/95 underline decoration-amber-400/60 underline-offset-2",
            "transition-colors hover:text-amber-100 hover:decoration-amber-300 disabled:opacity-60"
          )}
        >
          {activation.activating ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Activating…
            </span>
          ) : (
            "Activate Line Now →"
          )}
        </button>
      </p>
    </div>
  )
})
