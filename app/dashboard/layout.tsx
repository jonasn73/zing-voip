"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppShell, type PageId } from "@/components/app-shell"

const VALID_PAGES: PageId[] = ["dashboard", "ai-flow", "activity", "leads", "contacts", "analytics", "settings"]

function getActivePage(pathname: string): PageId {
  const segment = pathname.replace(/^\/dashboard\/?/, "").trim() || "dashboard"
  return VALID_PAGES.includes(segment as PageId) ? (segment as PageId) : "dashboard"
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Middleware already requires a session cookie — paint the shell immediately.
  // Validate the session in the background so bad/expired cookies still redirect without blocking first paint.
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
