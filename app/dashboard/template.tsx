// ============================================
// Dashboard route template (Next.js App Router)
// ============================================
// Next remounts the template on every navigation between sibling routes under
// /dashboard (e.g. /dashboard → /dashboard/ai-flow). Layout state is kept, but
// this subtree is fresh — so React cannot briefly show the previous tab’s UI
// after a refresh or client navigation.

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return children
}
