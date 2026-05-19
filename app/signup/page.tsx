"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthPage } from "@/components/auth-pages"

function SignupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planQuery = searchParams.get("plan")
  const onboardingTarget = planQuery ? `/onboarding?plan=${encodeURIComponent(planQuery)}` : "/onboarding"

  return (
    <AuthPage
      mode="signup"
      onNavigate={(page) => {
        if (page === "landing") router.push("/")
        else if (page === "login") router.push("/login")
        else if (page === "onboarding") router.push(onboardingTarget)
      }}
      onAuth={(ctx) => router.replace(ctx?.operator_access ? "/admin" : onboardingTarget)}
    />
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  )
}
