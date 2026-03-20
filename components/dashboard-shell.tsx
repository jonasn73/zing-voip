"use client"

// ============================================
// Client chrome for /dashboard/* (nav + session check).
// ============================================
// `pathnameFromRequest` comes from middleware (x-zing-pathname) via the server
// layout. Until the client has mounted, we use that for the active tab + Link
// context so the shell never briefly disagrees with the real URL during hydration.

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppShell, type PageId } from "@/components/app-shell"

const VALID_PAGES: PageId[] = ["dashboard", "ai-flow", "activity", "leads", "contacts", "analytics", "settings"]

function getActivePage(pathname: string): PageId {
  const segment = pathname.replace(/^\/dashboard\/?/, "").trim() || "dashboard"
  return VALID_PAGES.includes(segment as PageId) ? (segment as PageId) : "dashboard"
}

export function DashboardShell({
  children,
  pathnameFromRequest,
}: {
  children: React.ReactNode
  /** Set from middleware request header — authoritative on first paint */
  pathnameFromRequest: string | null
}) {
  const clientPathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.status === 401 || !res.ok) {
          router.replace("/login")
        }
      })
      .catch(() => router.replace("/login"))
  }, [router])

  // Before mount: match the server (middleware header + RSC) so hydration matches.
  // After mount: trust the real browser URL — usePathname() can lag one frame after
  // refresh/navigation, which used to highlight "Routing" and reset scroll while the
  // document was actually /dashboard/ai-flow (etc.).
  const pathname =
    !mounted && pathnameFromRequest != null && pathnameFromRequest.startsWith("/dashboard")
      ? pathnameFromRequest
      : typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")
        ? window.location.pathname
        : clientPathname

  const activePage = getActivePage(pathname)

  return (
    <AppShell activePage={activePage} pathname={pathname}>
      {children}
    </AppShell>
  )
}
