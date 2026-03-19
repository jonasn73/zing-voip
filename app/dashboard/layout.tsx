"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppShell, type PageId } from "@/components/app-shell"
import { DashboardPage } from "@/components/dashboard-page"
import { ActivityPage } from "@/components/activity-page"
import { ContactsPage } from "@/components/contacts-page"
import { AnalyticsPage } from "@/components/analytics-page"
import { SettingsPage } from "@/components/settings-page"

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
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login")
          return
        }
        if (!res.ok) {
          router.replace("/login")
          return
        }
        setAllowed(true)
      })
      .catch(() => router.replace("/login"))
  }, [router])

  if (allowed === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!allowed) return null

  const activePage = getActivePage(pathname)

  const handleNavigate = (page: PageId) => {
    if (page === "dashboard") router.push("/dashboard")
    else if (page === "ai-flow") router.push("/dashboard/ai-flow")
    else router.push(`/dashboard/${page}`)
  }

  return (
    <AppShell activePage={activePage} onNavigate={handleNavigate}>
      {children}
    </AppShell>
  )
}
