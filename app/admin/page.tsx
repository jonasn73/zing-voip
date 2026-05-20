"use client"

import { useState } from "react"
import { LyncrAdminDashboard } from "@/components/lyncr-admin-dashboard"
import { useLyncrAdminDashboardData } from "@/hooks/use-lyncr-admin-dashboard"

export default function AdminHomePage() {
  const { metrics, users, loading, refreshing, fetchLatestAdminStats } = useLyncrAdminDashboardData()
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({})

  function setCreditInputForUser(userId: string, value: string) {
    setCreditInputs((prev) => ({ ...prev, [userId]: value }))
  }

  return (
    <LyncrAdminDashboard
      metrics={metrics}
      users={users}
      loading={loading}
      refreshing={refreshing}
      fetchLatestAdminStats={fetchLatestAdminStats}
      creditInputs={creditInputs}
      setCreditInputForUser={setCreditInputForUser}
    />
  )
}
