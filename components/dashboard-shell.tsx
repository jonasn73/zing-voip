"use client"

// ============================================
// Client chrome for /dashboard/* (nav + session check).
// ============================================
// Kept separate from app/dashboard/layout.tsx so the layout can stay a Server
// Component — avoids an extra client boundary wrapping the whole segment tree
// (reduces wrong-route / loading flashes on refresh).

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppShell, type PageId } from "@/components/app-shell"

const VALID_PAGES: PageId[] = ["dashboard", "ai-flow", "activity", "leads", "contacts", "analytics", "settings"]

function getActivePage(pathname: string): PageId {
  const segment = pathname.replace(/^\/dashboard\/?/, "").trim() || "dashboard"
  return VALID_PAGES.includes(segment as PageId) ? (segment as PageId) : "dashboard"
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.status === 401 || !res.ok) {
          router.replace("/login")
        }
      })
      .catch(() => router.replace("/login"))
  }, [router])

  const activePage = getActivePage(pathname)

  return (
    <AppShell activePage={activePage} pathname={pathname}>
      {children}
    </AppShell>
  )
}
