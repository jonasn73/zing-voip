import { DashboardShell } from "@/components/dashboard-shell"

// Server Component layout: page `children` stay on the server/RSC path until they
// reach DashboardShell, which improves correct first paint on hard refresh.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
