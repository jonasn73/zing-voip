import { headers } from "next/headers"
import { DashboardShell } from "@/components/dashboard-shell"

// Fresh HTML per navigation — avoids reusing a stale static shell across routes.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const pathnameFromRequest = h.get("x-zing-pathname")

  return (
    <DashboardShell pathnameFromRequest={pathnameFromRequest}>
      {children}
    </DashboardShell>
  )
}
