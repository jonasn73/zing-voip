"use server"

// Admin-only server actions for the internal dev sandbox board.

import { revalidatePath } from "next/cache"
import { AdminAuthError, requireLyncrAdminSession } from "@/lib/admin-server-auth"
import {
  getSandboxEnvironment,
  listSandboxIntakeLogs,
  seedSandboxData,
  triggerMockCall,
  type SandboxEnvironment,
  type SandboxIntakeLogRow,
  type SeedSandboxDataResult,
  type TriggerMockCallResult,
} from "@/lib/sandbox-engine"

export type {
  SandboxEnvironment,
  SandboxIntakeLogRow,
  SeedSandboxDataResult,
  TriggerMockCallResult,
}

async function guardAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireLyncrAdminSession()
    return { ok: true }
  } catch (e) {
    if (e instanceof AdminAuthError) return { ok: false, error: e.message }
    return { ok: false, error: "Forbidden" }
  }
}

/** Operator-only: seed Test Locksmith Co. workspace + automotive_core certification. */
export async function runSeedSandboxData(): Promise<SeedSandboxDataResult> {
  const auth = await guardAdmin()
  if (!auth.ok) return auth

  const result = await seedSandboxData()
  if (result.ok) {
    revalidatePath("/admin/sandbox")
  }
  return result
}

/** Operator-only: fire a simulated inbound call to online receptionists on a business line. */
export async function runTriggerMockCall(businessLineId: string): Promise<TriggerMockCallResult> {
  const auth = await guardAdmin()
  if (!auth.ok) return auth

  const result = await triggerMockCall(businessLineId)
  if (result.ok) {
    revalidatePath("/admin/sandbox")
  }
  return result
}

/** Operator-only: load sandbox workspace snapshot for the admin board. */
export async function fetchSandboxEnvironment(): Promise<SandboxEnvironment | null> {
  const auth = await guardAdmin()
  if (!auth.ok) return null
  return getSandboxEnvironment()
}

/** Operator-only: latest intake_payload rows for debugging dispatch. */
export async function fetchSandboxIntakeLogs(limit = 25): Promise<SandboxIntakeLogRow[]> {
  const auth = await guardAdmin()
  if (!auth.ok) return []
  return listSandboxIntakeLogs(limit)
}
