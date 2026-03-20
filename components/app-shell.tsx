"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import {
  Phone,
  Users,
  BarChart3,
  Settings,
  Zap,
  ClipboardList,
  Inbox,
  Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { id: "dashboard", label: "Routing", icon: Zap },
  { id: "ai-flow", label: "AI flow", icon: Bot },
  { id: "activity", label: "Activity", icon: ClipboardList },
  { id: "leads", label: "Leads", icon: Inbox },
  { id: "contacts", label: "Team", icon: Users },
  { id: "analytics", label: "Pay", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const

export type PageId = (typeof navItems)[number]["id"]

/** Href for each tab — use Link (not router.push) so App Router always swaps the page under this client layout. */
const PAGE_HREF: Record<PageId, string> = {
  dashboard: "/dashboard",
  "ai-flow": "/dashboard/ai-flow",
  activity: "/dashboard/activity",
  leads: "/dashboard/leads",
  contacts: "/dashboard/contacts",
  analytics: "/dashboard/analytics",
  settings: "/dashboard/settings",
}

export function AppShell({
  activePage,
  pathname,
  onNavigate,
  children,
}: {
  activePage: PageId
  /** Set on real routes (e.g. /dashboard/*) — bottom nav uses Link for correct App Router transitions */
  pathname?: string
  /** Set on the marketing / root in-memory shell — tab switches without changing URL */
  onNavigate?: (page: PageId) => void
  children: ReactNode
}) {
  const useLinks = Boolean(pathname)
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl">
        {useLinks ? (
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Go to home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Phone className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Zing</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate?.("dashboard")}
            className="flex cursor-pointer items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Go to routing"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Phone className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Zing</span>
          </button>
        )}
        <div className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-2.5 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[11px] font-medium text-success">Live</span>
        </div>
      </header>

      {/* No key on main — remounting here caused a flash of the previous route on refresh/navigation */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[max(env(safe-area-inset-bottom),0px)]">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav
        className="sticky bottom-0 z-40 shrink-0 border-t border-border/70 bg-background/80 pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur-xl"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-2 my-2 flex items-center justify-around rounded-2xl border border-border/60 bg-card/70 px-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            const className = cn(
              "flex min-h-11 min-w-[58px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all",
              isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground"
            )
            const inner = (
              <>
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    isActive && "drop-shadow-[0_0_5px_var(--primary)]"
                  )}
                />
                <span className="text-[11px] font-medium">{item.label}</span>
              </>
            )
            if (useLinks) {
              return (
                <Link
                  key={item.id}
                  href={PAGE_HREF[item.id]}
                  className={className}
                  aria-current={isActive ? "page" : undefined}
                >
                  {inner}
                </Link>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                className={className}
                aria-current={isActive ? "page" : undefined}
              >
                {inner}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
