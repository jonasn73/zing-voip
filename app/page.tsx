"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthPage } from "@/components/auth-pages"
import { OnboardingPage } from "@/components/onboarding-page"
import { ErrorBoundary } from "@/components/error-boundary"

// Entry: session check → /dashboard if logged in, else login/signup/onboarding.
// The real app (all tabs including AI flow + Leads) lives under /dashboard/* — do not duplicate shell here.

type AppView = "loading" | "login" | "signup" | "onboarding"

export default function Home() {
  const router = useRouter()
  const [view, setView] = useState<AppView>("loading")

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          router.replace("/dashboard")
        } else {
          setView("login")
        }
      })
      .catch(() => {
        setView("login")
      })
  }, [router])

  function handleNavigate(page: string) {
    if (page === "login" || page === "signup" || page === "onboarding") {
      setView(page)
    }
  }

  function handleAuth() {
    router.replace("/dashboard")
  }

  function handleSignup() {
    setView("onboarding")
  }

  function handleOnboardingComplete() {
    router.replace("/dashboard")
  }

  return (
    <ErrorBoundary>
      {view === "loading" ? (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : view === "login" || view === "signup" ? (
        <AuthPage
          mode={view}
          onNavigate={handleNavigate}
          onAuth={view === "signup" ? handleSignup : handleAuth}
        />
      ) : (
        <OnboardingPage onComplete={handleOnboardingComplete} />
      )}
    </ErrorBoundary>
  )
}
