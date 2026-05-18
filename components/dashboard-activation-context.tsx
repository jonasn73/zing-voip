"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  fetchOnboardingProfile,
  fetchOnboardingProvisionMode,
  type OnboardingProvisionMode,
} from "@/lib/onboarding-profile-client"
import type { OnboardingProfile } from "@/lib/types"
import { ActivateLineModal } from "@/components/activate-line-modal"

export const SUBSCRIPTION_ACTIVATED_EVENT = "zing-subscription-activated"

type DashboardActivationContextValue = {
  profile: OnboardingProfile | null
  loading: boolean
  /** Billing flag from Neon — payment method on file. */
  subscriptionActive: boolean
  /** Carrier owns the DID — inbound calls can route (Telnyx SID + active status). */
  lineCarrierLive: boolean
  reservedDisplay: string | null
  simulationMode: boolean
  refreshProfile: () => Promise<void>
  openActivateModal: () => void
}

const DashboardActivationContext = createContext<DashboardActivationContextValue | null>(null)

export function DashboardActivationProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null)
  const [carrierLive, setCarrierLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [provisionMode, setProvisionMode] = useState<OnboardingProvisionMode>({
    simulation_mode: true,
    notice: null,
  })

  const refreshProfile = useCallback(async () => {
    setLoading(true)
    try {
      const [snapshot, mode] = await Promise.all([fetchOnboardingProfile(), fetchOnboardingProvisionMode()])
      setProfile(snapshot.profile)
      setCarrierLive(snapshot.carrierLive)
      setProvisionMode(mode)
    } catch {
      setProfile(null)
      setCarrierLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    const onActivated = () => void refreshProfile()
    window.addEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated)
    return () => window.removeEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated)
  }, [refreshProfile])

  const reservedDisplay =
    profile?.reserved_number_display?.trim() || profile?.reserved_number?.trim() || null

  const value = useMemo(
    (): DashboardActivationContextValue => ({
      profile,
      loading,
      subscriptionActive: profile?.has_active_subscription === true,
      lineCarrierLive: carrierLive,
      reservedDisplay,
      simulationMode: provisionMode.simulation_mode,
      refreshProfile,
      openActivateModal: () => setModalOpen(true),
    }),
    [profile, loading, carrierLive, reservedDisplay, provisionMode.simulation_mode, refreshProfile]
  )

  return (
    <DashboardActivationContext.Provider value={value}>
      {children}
      <ActivateLineModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        reservedDisplay={reservedDisplay}
        onActivated={async () => {
          await refreshProfile()
          window.dispatchEvent(new Event(SUBSCRIPTION_ACTIVATED_EVENT))
        }}
      />
    </DashboardActivationContext.Provider>
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
