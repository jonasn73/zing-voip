"use client"

// Full-width dashboard alert when a number transfer was rejected by the carrier.

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useDashboardWorkspace } from "@/components/dashboard-workspace-context"
import { requestOpenManageNumbersModal } from "@/components/dashboard-numbers-modal-context"
import { formatPhoneDisplay } from "@/lib/dashboard-routing-utils"
import { organizationQueryString } from "@/lib/workspace-organizations"
import type { PortingOrder } from "@/lib/types"

/** Load rejected port orders for the active workspace. */
async function fetchRejectedPortOrders(organizationId: string | null): Promise<PortingOrder[]> {
  const orgQs = organizationQueryString(organizationId)
  const res = await fetch(`/api/porting/orders${orgQs}`, { credentials: "include" })
  if (!res.ok) return []
  const json = (await res.json().catch(() => ({}))) as { data?: { orders?: PortingOrder[] } }
  const orders = Array.isArray(json.data?.orders) ? json.data.orders : []
  return orders.filter((o) => o.status === "rejected")
}

/** Build the banner sentence for one rejected transfer. */
function buildRejectionMessage(order: PortingOrder): string {
  const phone = formatPhoneDisplay(order.phone_number)
  const reason =
    order.carrier_rejection_reason?.trim() || "Carrier needs a correction before the transfer can continue."
  return `⚠️ Number Transfer Action Required: Your port request for ${phone} was rejected by the carrier due to: ${reason}. Click here to update your PIN.`
}

export function PortingStatusBanner() {
  const { activeOrganizationId } = useDashboardWorkspace()
  const [rejected, setRejected] = useState<PortingOrder[]>([])

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchRejectedPortOrders(activeOrganizationId)
      setRejected(rows)
    } catch {
      setRejected([])
    }
  }, [activeOrganizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = () => void refresh()
    window.addEventListener("lyncr-organization-changed", onChanged)
    window.addEventListener("lyncr-workspace-data-changed", onChanged)
    window.addEventListener("zing-porting-orders-changed", onChanged)
    return () => {
      window.removeEventListener("lyncr-organization-changed", onChanged)
      window.removeEventListener("lyncr-workspace-data-changed", onChanged)
      window.removeEventListener("zing-porting-orders-changed", onChanged)
    }
  }, [refresh])

  if (rejected.length === 0) return null

  const primary = rejected[0]
  const extraCount = rejected.length - 1

  return (
    <button
      type="button"
      onClick={() => requestOpenManageNumbersModal()}
      className="group -mx-5 mb-5 flex w-[calc(100%+2.5rem)] cursor-pointer items-start gap-3 border-b border-red-500/40 bg-gradient-to-r from-red-950/95 via-red-900/90 to-amber-950/85 px-5 py-3.5 text-left shadow-[0_4px_24px_rgba(220,38,38,0.15)] transition-colors hover:from-red-900/95 hover:via-red-800/90 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8"
      aria-label="Open lines and numbers to correct rejected port transfer"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-300 group-hover:text-amber-200"
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-red-50 group-hover:text-white">
        {buildRejectionMessage(primary)}
        {extraCount > 0 ? (
          <span className="mt-1 block text-xs font-normal text-red-200/80">
            +{extraCount} more rejected transfer{extraCount === 1 ? "" : "s"} in this workspace
          </span>
        ) : null}
      </span>
      <span className="hidden shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-200 group-hover:bg-amber-500/25 sm:inline">
        Fix PIN →
      </span>
    </button>
  )
}
