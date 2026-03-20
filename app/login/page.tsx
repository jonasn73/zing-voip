"use client"

import { useRouter } from "next/navigation"
import { AuthPage } from "@/components/auth-pages"

/** After login, return to ?next=… if it is a safe in-app path (avoid open redirects). */
function postLoginPath(): string {
  if (typeof window === "undefined") return "/dashboard"
  const next = new URLSearchParams(window.location.search).get("next")
  if (next && next.startsWith("/dashboard")) return next
  return "/dashboard"
}

export default function LoginPage() {
  const router = useRouter()
  return (
    <AuthPage
      mode="login"
      onNavigate={(page) => {
        if (page === "landing") router.push("/")
        else if (page === "signup") router.push("/signup")
      }}
      onAuth={() => router.replace(postLoginPath())}
    />
  )
}
