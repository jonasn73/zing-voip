"use client"

import { Suspense } from "react"
import { OnboardingPage } from "@/components/onboarding-page"

function OnboardingRouteInner() {
  return (
    <OnboardingPage
      onComplete={() => {
        window.location.assign("/dashboard")
      }}
    />
  )
}

/** Post-signup wizard — requires a session (see middleware). */
export default function OnboardingRoutePage() {
  return (
    <Suspense fallback={null}>
      <OnboardingRouteInner />
    </Suspense>
  )
}
