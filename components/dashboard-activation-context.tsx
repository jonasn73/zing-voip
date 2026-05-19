"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import {
  fetchOnboardingProfile,
  fetchOnboardingProvisionMode,
  confirmStripeSubscriptionAfterCheckout,
  provisionLineAfterPayment,
  startStripeSubscriptionCheckout,
  type OnboardingProvisionMode,
} from "@/lib/onboarding-profile-client"
import type { CheckoutSubscriptionTier } from "@/lib/subscription-checkout"
import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import type { OnboardingProfile } from "@/lib/types"
import { isVerifiedActiveSubscription } from "@/lib/onboarding-subscription-status"
import { useToast } from "@/hooks/use-toast"

export const SUBSCRIPTION_ACTIVATED_EVENT = "zing-subscription-activated"

type DashboardActivationContextValue = {
  profile: OnboardingProfile | null
  loading: boolean
  activating: boolean
  subscriptionActive: boolean
  showTrialBanner: boolean
  showProvisioningBanner: boolean
  lineCarrierLive: boolean
  billingCycleEnd: string | null
  reservedDisplay: string | null
  simulationMode: boolean
  refreshProfile: (opts?: { silent?: boolean }) => Promise<void>
  applyActivatedProfile: (profile: OnboardingProfile) => void
  /** Opens live Stripe Checkout when subscription is not active. */
  requestLineActivation: (tier?: import("@/lib/subscription-checkout").CheckoutSubscriptionTier) => Promise<void>
}

const DashboardActivationContext = createContext<DashboardActivationContextValue | null>(null)

export function DashboardActivationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<OnboardingProfile | null>(null)
  const [carrierLive, setCarrierLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<CheckoutSubscriptionTier>("starter")
  const [provisionMode, setProvisionMode] = useState<OnboardingProvisionMode>({
    simulation_mode: true,
    notice: null,
  })

  const refreshProfile = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const [snapshot, mode] = await Promise.all([fetchOnboardingProfile(), fetchOnboardingProvisionMode()])
      setProfile(snapshot.profile)
      setCarrierLive(snapshot.carrierLive)
      setProvisionMode(mode)
    } catch {
      if (!opts?.silent) {
        setProfile(null)
        setCarrierLive(false)
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  const applyActivatedProfile = useCallback((activated: OnboardingProfile) => {
    setProfile(activated)
  }, [])

  const requestLineActivation = useCallback(async (tier: CheckoutSubscriptionTier = checkoutTier) => {
    if (activating) return
    if (isVerifiedActiveSubscription(profile, carrierLive)) return

    setActivating(true)
    try {
      const { checkoutUrl } = await startStripeSubscriptionCheckout(tier)
      window.location.href = checkoutUrl
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout"
      toast({ variant: "destructive", title: "Checkout failed", description: msg })
      setActivating(false)
    }
  }, [activating, profile, carrierLive, checkoutTier, toast])

  const reservedDisplay =
    profile?.reserved_number_display?.trim() || profile?.reserved_number?.trim() || null

  const subscriptionActive = isVerifiedActiveSubscription(profile, carrierLive)
  const showTrialBanner = Boolean(reservedDisplay) && !subscriptionActive
  const showProvisioningBanner = Boolean(reservedDisplay) && subscriptionActive && !carrierLive
  const billingCycleEnd = profile?.billing_cycle_end?.trim() || null

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    const onActivated = () => void refreshProfile()
    window.addEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated)
    return () => window.removeEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated)
  }, [refreshProfile])

  useEffect(() => {
    if (loading || subscriptionActive || !profile?.reserved_number) return
    if (sessionStorage.getItem("lyncr-stripe-recover")) return
    sessionStorage.setItem("lyncr-stripe-recover", "1")
    void (async () => {
      try {
        await confirmStripeSubscriptionAfterCheckout()
        await refreshProfile({ silent: true })
      } catch {
        sessionStorage.removeItem("lyncr-stripe-recover")
      }
    })()
  }, [loading, subscriptionActive, profile?.reserved_number, refreshProfile])

  useEffect(() => {
    if (loading || !profile?.reserved_number || carrierLive || !subscriptionActive) return
    if (sessionStorage.getItem("lyncr-line-provision")) return
    sessionStorage.setItem("lyncr-line-provision", "1")
    void (async () => {
      try {
        const result = await provisionLineAfterPayment()
        if (result.substituted) {
          toast({
            title: "Line updated",
            description: `Your original number was unavailable. We assigned ${formatPhoneDisplay(result.phone_number)} in the same area code.`,
          })
        }
        await refreshProfile({ silent: true })
      } catch (e) {
        sessionStorage.removeItem("lyncr-line-provision")
        const msg = e instanceof Error ? e.message : "Could not provision your business line."
        toast({ variant: "destructive", title: "Line not live yet", description: msg })
      }
    })()
  }, [loading, profile?.reserved_number, carrierLive, subscriptionActive, refreshProfile, toast])

  useEffect(() => {
    const checkout = searchParams.get("stripe_checkout")
    const sessionId = searchParams.get("session_id")
    if (checkout === "success") {
      void (async () => {
        try {
          await confirmStripeSubscriptionAfterCheckout(sessionId)
          toast({
            title: "Payment received",
            description: "Your subscription is active. Provisioning your line may take a moment.",
          })
          await refreshProfile({ silent: true })
        } catch {
          try {
            await confirmStripeSubscriptionAfterCheckout()
            toast({
              title: "Payment received",
              description: "Your subscription is now linked to your account.",
            })
            await refreshProfile({ silent: true })
          } catch {
            toast({
              title: "Payment received",
              description:
                "We could not sync automatically yet. Refresh in a minute or contact support if trial mode persists.",
            })
          }
        }
        window.history.replaceState({}, "", "/dashboard")
      })()
    } else if (checkout === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "Your line is still in trial mode until you complete payment.",
      })
      window.history.replaceState({}, "", "/dashboard")
    }
  }, [searchParams, refreshProfile, toast])

  const value = useMemo(
    (): DashboardActivationContextValue => ({
      profile,
      loading,
      activating,
      subscriptionActive,
      showTrialBanner,
      showProvisioningBanner,
      lineCarrierLive: carrierLive,
      billingCycleEnd,
      reservedDisplay,
      simulationMode: provisionMode.simulation_mode,
      refreshProfile,
      applyActivatedProfile,
      requestLineActivation,
    }),
    [
      profile,
      loading,
      activating,
      subscriptionActive,
      showTrialBanner,
      showProvisioningBanner,
      carrierLive,
      billingCycleEnd,
      reservedDisplay,
      provisionMode.simulation_mode,
      refreshProfile,
      applyActivatedProfile,
      requestLineActivation,
    ]
  )

  return (
    <DashboardActivationContext.Provider value={value}>{children}</DashboardActivationContext.Provider>
  )
}

export function useDashboardActivation(): DashboardActivationContextValue {
  const ctx = useContext(DashboardActivationContext)
  if (!ctx) {
    throw new Error("useDashboardActivation must be used within DashboardActivationProvider")
  }
  return ctx
}

export function useDashboardActivationOptional(): DashboardActivationContextValue | null {
  return useContext(DashboardActivationContext)
}
