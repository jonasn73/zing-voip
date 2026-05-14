import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifySessionCookie, getSessionCookieName } from "@/lib/auth"
import { getUser } from "@/lib/db"
import { isPlatformAdminUser } from "@/lib/platform-admin"
import type { User } from "@/lib/types"
import { AdminChrome } from "@/components/admin-chrome"

export const dynamic = "force-dynamic"

async function userForAdminGate(): Promise<User | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(getSessionCookieName())?.value
  const userId = verifySessionCookie(raw)
  if (!userId) return null
  if (process.env.NODE_ENV === "development" && userId === "dev-user") {
    const devEmail = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase() ?? "dev@zing.local"
    return {
      id: "dev-user",
      email: devEmail,
      name: "Dev User",
      phone: "+15551234567",
      business_name: "My Business",
      inbound_receptionist_whisper_enabled: true,
      industry: "generic",
      telnyx_ai_assistant_id: null,
      created_at: new Date().toISOString(),
      credit_balance_cents: 0,
      billing_plan: "trial",
      is_platform_admin: false,
    }
  }
  return getUser(userId)
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await userForAdminGate()
  if (!user) redirect("/login?next=/admin")
  if (!isPlatformAdminUser(user)) redirect("/dashboard")
  const displayName = user.name?.trim() || user.email
  return (
    <AdminChrome userName={displayName} userEmail={user.email}>
      {children}
    </AdminChrome>
  )
}
