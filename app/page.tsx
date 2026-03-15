"use client"

import { useState } from "react"
import { AppShell, type PageId } from "@/components/app-shell"
import { DashboardPage } from "@/components/dashboard-page"
import { ActivityPage } from "@/components/activity-page"
import { ContactsPage } from "@/components/contacts-page"
import { AnalyticsPage } from "@/components/analytics-page"
import { SettingsPage } from "@/components/settings-page"
import { AuthPage } from "@/components/auth-pages"
import { OnboardingPage } from "@/components/onboarding-page"

// App flow: login → app (existing users) or signup → onboarding → app (new users)
// The landing page (components/landing-page.tsx) is for the separate marketing website.
type AppView = "login" | "signup" | "onboarding" | "app"

export default function Home() {
  const [view, setView] = useState<AppView>("login")
  const [activePage, setActivePage] = useState<PageId>("dashboard")

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

  // Auth screens (app opens here)
  if (view === "login" || view === "signup") {
    return (
      <AuthPage
        mode={view}
        onNavigate={handleNavigate}
        onAuth={view === "signup" ? handleSignup : handleAuth}
      />
    )
  }

  // Onboarding (new users only -- get number, add receptionist, configure AI)
  if (view === "onboarding") {
    return <OnboardingPage onComplete={handleOnboardingComplete} />
  }

  // Main app
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
