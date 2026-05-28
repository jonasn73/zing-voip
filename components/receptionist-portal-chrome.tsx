"use client"

// Minimal chrome for the receptionist payout portal.

import Link from "next/link"
import { LogOut, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ReceptionistPortalChrome({
  userName,
  children,
}: {
  userName: string
  children: React.ReactNode
}) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Phone className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Receptionist</p>
              <p className="text-sm font-semibold text-foreground">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-foreground">
              <Link href="/receptionist">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-foreground">
              <Link href="/receptionist/training">Training</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
