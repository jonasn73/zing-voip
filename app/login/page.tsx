"use client"

import { useRouter } from "next/navigation"
import { AuthPage } from "@/components/auth-pages"

export default function LoginPage() {
  const router = useRouter()
  return (
    <AuthPage
      mode="login"
      onNavigate={(page) => {
        if (page === "landing") router.push("/")
        else if (page === "signup") router.push("/signup")
      }}
      onAuth={() => router.push("/dashboard")}
    />
  )
}
