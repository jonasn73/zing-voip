"use client"

import { useState, useEffect } from "react"
import { AppShell, type PageId } from "@/components/app-shell"
import { DashboardPage } from "@/components/dashboard-page"
import { ActivityPage } from "@/components/activity-page"
import { ContactsPage } from "@/components/contacts-page"
import { AnalyticsPage } from "@/components/analytics-page"
import { SettingsPage } from "@/components/settings-page"
import { AuthPage } from "@/components/auth-pages"
import { OnboardingPage } from "@/components/onboarding-page"

type AppView = "login" | "signup" | "onboarding" | "app"

export default function Home() {
  const [view, setView] = useState<AppView>("login")
  const [activePage, setActivePage] = useState<PageId>("dashboard")
  const [authChecked, setAuthChecked] = useState(false)

  // On load, check session and go to app if already logged in
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.ok) setView("app")
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  function handleNavigate(page: string) {
    if (page === "login" || page === "signup" || page === "onboarding") {
      setView(page)
    } else if (page === "app") {
      setView("app")
    }
  }

  function handleAuth() {
    setView("app")
  }

  function handleSignup() {
    setView("onboarding")
  }

  function handleOnboardingComplete() {
    setView("app")
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (view === "login" || view === "signup") {
    return (
      <AuthPage
        mode={view}
        onNavigate={handleNavigate}
        onAuth={view === "signup" ? handleSignup : handleAuth}
      />
    )
  }

  if (view === "onboarding") {
    return <OnboardingPage onComplete={handleOnboardingComplete} />
  }

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "dashboard" && <DashboardPage />}
      {activePage === "activity" && <ActivityPage />}
      {activePage === "contacts" && <ContactsPage />}
      {activePage === "analytics" && <AnalyticsPage />}
      {activePage === "settings" && <SettingsPage />}
    </AppShell>
  )
}
