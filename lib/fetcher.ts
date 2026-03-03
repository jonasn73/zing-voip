// Fetcher that sends cookies so API routes receive the session
export const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) {
      const err = new Error(res.status === 401 ? "Not authenticated" : "Request failed")
      ;(err as Error & { status?: number }).status = res.status
      throw err
    }
    return res.json()
  })

// POST/PUT with JSON body and credentials
export async function fetchJson(
  url: string,
  options: { method?: string; body?: unknown }
): Promise<Response> {
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? res.statusText)
  }
  return res
}
