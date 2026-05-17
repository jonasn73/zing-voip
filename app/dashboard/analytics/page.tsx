import { redirect } from "next/navigation"

/** Legacy URL — `/dashboard/analytics` conflicted with Vercel Analytics; use `/dashboard/pay`. */
export default function AnalyticsRedirectPage() {
  redirect("/dashboard/pay")
}
