"use client"

import { useRouter } from "next/navigation"
import { OnboardingPage } from "@/components/onboarding-page"

/** Post-signup wizard — requires a session (see middleware). */
export default function OnboardingRoutePage() {
  const router = useRouter()
  return <OnboardingPage onComplete={() => router.replace("/dashboard")} />
}
