"use client"

import { type ReactNode } from "react"
import {
  Phone,
  Users,
  BarChart3,
  Settings,
  Zap,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { id: "dashboard", label: "Routing", icon: Zap },
  { id: "activity", label: "Activity", icon: ClipboardList },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "analytics", label: "Pay", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const

export type PageId = (typeof navItems)[number]["id"]

export function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Switchr
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">System Active</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Bottom navigation */}
      <nav className="sticky bottom-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    isActive && "drop-shadow-[0_0_6px_var(--primary)]"
                  )}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="h-0.5 w-4 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
