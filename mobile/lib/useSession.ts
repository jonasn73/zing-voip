import { useEffect, useState } from "react"
import { apiGet } from "./api"

/** Returns the current user if logged in, null otherwise. */
export function useSession(): { user: { id: string; name: string; email: string } | null; loading: boolean } {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<{ user?: { id: string; name: string; email: string } }>("/api/auth/session")
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
