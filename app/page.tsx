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
import { ErrorBoundary } from "@/components/error-boundary"

// App flow: login → app (existing users) or signup → onboarding → app (new users)
// "loading" is shown briefly while we check for an existing session cookie.
type AppView = "loading" | "login" | "signup" | "onboarding" | "app"

export default function Home() {
  const [view, setView] = useState<AppView>("loading")
  const [activePage, setActivePage] = useState<PageId>("dashboard")

  // On page load, check if there's already a valid session — skip login if so
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setView("app")
        } else {
          setView("login")
        }
      })
      .catch(() => {
        setView("login")
      })
  }, [])

  function handleNavigate(page: string) {
    if (page === "login" || page === "signup" || page === "onboarding") {
      setView(page)
    } else if (page === "app") {
      setView("app")
    }
  }

  function handleAuth() {
    // Existing user logs in → go straight to the app
    setView("app")
  }

  function handleSignup() {
    // New user signs up → go through onboarding first
    setView("onboarding")
  }

  function handleOnboardingComplete() {
    setView("app")
  }

  return (
    <ErrorBoundary>
      {/* Loading: checking session */}
      {view === "loading" ? (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : /* Auth screens */
      view === "login" || view === "signup" ? (
        <AuthPage
          mode={view}
          onNavigate={handleNavigate}
          onAuth={view === "signup" ? handleSignup : handleAuth}
        />
      ) : view === "onboarding" ? (
        <OnboardingPage onComplete={handleOnboardingComplete} />
      ) : (
        <AppShell activePage={activePage} onNavigate={setActivePage}>
          {activePage === "dashboard" && <DashboardPage />}
          {activePage === "activity" && <ActivityPage />}
          {activePage === "contacts" && <ContactsPage />}
          {activePage === "analytics" && <AnalyticsPage />}
          {activePage === "settings" && <SettingsPage />}
        </AppShell>
      )}
    </ErrorBoundary>
  )
}
