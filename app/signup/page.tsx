"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthPage } from "@/components/auth-pages"
import { resolvePostAuthPath } from "@/lib/post-auth-redirect"
import type { TeamInvitePreview } from "@/lib/types"

function SignupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planQuery = searchParams.get("plan")
  const inviteToken = searchParams.get("invite")
  const onboardingTarget = planQuery ? `/onboarding?plan=${encodeURIComponent(planQuery)}` : "/onboarding"

  const [invite, setInvite] = useState<TeamInvitePreview | null>(null)
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken))
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!inviteToken) return
    setInviteLoading(true)
    fetch(`/api/invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(async (res) => {
        const json = (await res.json()) as { error?: string; data?: TeamInvitePreview }
        if (!res.ok) throw new Error(json.error ?? "Invalid invite")
        setInvite(json.data ?? null)
        setInviteError(null)
      })
      .catch((e) => {
        setInvite(null)
        setInviteError(e instanceof Error ? e.message : "Invalid invite")
      })
      .finally(() => setInviteLoading(false))
  }, [inviteToken])

  return (
    <AuthPage
      mode="signup"
      invite={invite}
      inviteToken={inviteToken}
      inviteLoading={inviteLoading}
      inviteError={inviteError}
      onNavigate={(page) => {
        if (page === "landing") router.push("/")
        else if (page === "login") router.push("/login")
        else if (page === "onboarding") router.push(onboardingTarget)
      }}
      onAuth={(ctx) => {
        if (ctx?.redirect) {
          router.replace(ctx.redirect)
          return
        }
        if (ctx?.account_role === "receptionist") {
          router.replace("/receptionist")
          return
        }
        if (ctx?.operator_access) {
          router.replace("/admin")
          return
        }
        router.replace(onboardingTarget)
      }}
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
