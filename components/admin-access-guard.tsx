"use client"

// Client-side guard: only admin@lyncr.app may stay on /admin.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isLyncrAdminEmail, LYNCR_ADMIN_EMAIL } from "@/lib/lyncr-admin"
import { Spinner } from "@/components/ui/spinner"

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" })
        if (!res.ok) {
          console.warn("[lyncr-admin] UNAUTHORIZED — no session; redirecting to /dashboard")
          router.replace("/dashboard")
          return
        }
        const json = (await res.json()) as { data?: { user?: { email?: string } } }
        const email = json.data?.user?.email ?? ""
        if (!isLyncrAdminEmail(email)) {
          console.warn(
            `[lyncr-admin] UNAUTHORIZED — expected ${LYNCR_ADMIN_EMAIL}, got "${email}"; redirecting to /dashboard`
          )
          router.replace("/dashboard")
          return
        }
        if (!cancelled) setAllowed(true)
      } catch {
        console.warn("[lyncr-admin] UNAUTHORIZED — session check failed; redirecting to /dashboard")
        router.replace("/dashboard")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-violet-400" />
      </div>
    )
  }

  return <>{children}</>
}
