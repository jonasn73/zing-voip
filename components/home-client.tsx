"use client"

// ============================================
// Home (logged-out): marketing landing → /signup or /login
// ============================================
// Session redirect runs on the server in `app/page.tsx` — this file only mounts when
// there is no valid session cookie. Primary entry is the landing page (not a login wall).

import { ErrorBoundary } from "@/components/error-boundary"
import { LandingPage } from "@/components/landing-page"

export function HomeClient() {
  return (
    <ErrorBoundary>
      <LandingPage signupUrl="/signup" loginUrl="/login" />
    </ErrorBoundary>
  )
}
