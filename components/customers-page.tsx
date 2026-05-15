"use client"

// ============================================
// CustomersPage — searchable saved callers (CRM-lite)
// ============================================

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookUser, Loader2, Search } from "lucide-react"
import type { Customer } from "@/lib/types"
import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import { IconSurface } from "@/components/ui/icon-surface"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function CustomersPage() {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Customer | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 320)
    return () => window.clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debounced) params.set("q", debounced)
    fetch(`/api/customers?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || "Could not load")
        }
        return res.json()
      })
      .then((data: { customers?: Customer[] }) => {
        setRows(Array.isArray(data.customers) ? data.customers : [])
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false))
  }, [debounced])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <IconSurface tone="primary">
          <BookUser className="h-5 w-5" />
        </IconSurface>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Customers</h1>
          <p className="text-xs text-muted-foreground">
            Saved when you answer calls (popup) or anytime via API. Search by name, phone, or address.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers…"
          className="h-11 pl-10"
          aria-label="Search customers"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          No customers yet. When you pick up an inbound call, a sheet will offer to save the caller here. Run{" "}
          <span className="font-mono text-[11px]">022-customers.sql</span> in Neon if saves fail.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setDetail(c)}
                className="w-full rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-card"
              >
                <p className="text-sm font-semibold text-foreground">{c.display_name || "Unnamed caller"}</p>
                <p className="text-xs text-muted-foreground">{formatPhoneDisplay(c.phone_e164)}</p>
                {c.company_name ? <p className="mt-1 text-[11px] text-muted-foreground">{c.company_name}</p> : null}
                {c.city || c.region ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {[c.city, c.region].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        <Link href="/dashboard" className="font-semibold text-primary underline-offset-2 hover:underline">
          Back to routing
        </Link>
      </p>

      <Sheet open={detail != null} onOpenChange={(o) => !o && setDetail(null)} modal>
        <SheetContent side="bottom" className="gap-0 p-0 sm:mx-auto sm:max-w-lg [&>button]:top-3">
          {detail ? (
            <>
              <SheetHeader className="border-b border-border/60 px-4 pb-3 pt-2 text-left">
                <SheetTitle className="text-left">{detail.display_name || "Customer"}</SheetTitle>
                <p className="text-left text-xs text-muted-foreground">{formatPhoneDisplay(detail.phone_e164)}</p>
              </SheetHeader>
              <div className="max-h-[min(60vh,400px)] space-y-2 overflow-y-auto px-4 py-3 text-sm">
                {detail.company_name ? (
                  <p>
                    <span className="font-medium text-foreground">Company:</span> {detail.company_name}
                  </p>
                ) : null}
                {(detail.address_line1 || detail.address_line2) && (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {[detail.address_line1, detail.address_line2].filter(Boolean).join("\n")}
                  </p>
                )}
                {(detail.city || detail.region || detail.postal_code) && (
                  <p className="text-muted-foreground">
                    {[detail.city, detail.region, detail.postal_code].filter(Boolean).join(", ")} {detail.country}
                  </p>
                )}
                {detail.notes ? (
                  <p>
                    <span className="font-medium text-foreground">Notes:</span> {detail.notes}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">Updated {new Date(detail.updated_at).toLocaleString()}</p>
              </div>
              <SheetFooter className="border-t border-border/70 px-4 py-3">
                <p className="text-[11px] text-muted-foreground">Edit from the next answered-call popup for this number.</p>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
