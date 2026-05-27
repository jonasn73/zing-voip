"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

type ImpersonationState = {
  active: boolean
  admin_user_id?: string
}

export function AdminImpersonationBanner() {
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null)
  const [viewingEmail, setViewingEmail] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  const loadSession = useCallback(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        const imp = data?.data?.impersonation as ImpersonationState | undefined
        const email = data?.data?.user?.email as string | undefined
        setImpersonation(imp ?? { active: false })
        setViewingEmail(email ?? null)
      })
      .catch(() => {
        setImpersonation({ active: false })
      })
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  async function handleExit() {
    setExiting(true)
    try {
      const res = await fetch("/api/admin/impersonate/exit", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; data?: { redirect?: string } }
      if (!res.ok) {
        throw new Error(json.error || "Could not exit impersonation")
      }
      window.location.href = json.data?.redirect ?? "/admin"
    } catch {
      setExiting(false)
    }
  }

  if (!impersonation?.active) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-950/90 px-4 py-2.5 text-sm text-amber-100"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <span>
          Impersonating workspace
          {viewingEmail ? (
            <>
              {" "}
              <span className="font-semibold text-amber-50">{viewingEmail}</span>
            </>
          ) : null}
          . Changes apply to this customer account.
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={exiting}
        className="h-8 border-amber-400/50 bg-transparent text-amber-100 hover:bg-amber-900/60 hover:text-white"
        onClick={() => void handleExit()}
      >
        {exiting ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            Exiting…
          </>
        ) : (
          "Exit impersonation"
        )}
      </Button>
    </div>
  )
}
