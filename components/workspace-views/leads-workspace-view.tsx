"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  DrawerStepHeader,
  DrawerScrollBody,
  DrawerStickyFooter,
} from "@/components/dashboard-routing-drawer-shared"
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspaceTableWrap,
  WorkspaceTh,
  WorkspaceTd,
  IntentPill,
  WORKSPACE_SHEET_CLASS,
} from "@/components/dashboard-workspace-ui"

interface LeadRow {
  id: string
  caller_e164: string | null
  intent_slug: string | null
  collected: Record<string, unknown>
  summary: string | null
  created_at: string
}

function formatCaller(num: string | null): string {
  if (!num) return "—"
  const d = num.replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return num
}

function leadName(lead: LeadRow): string {
  const c = lead.collected
  if (c && typeof c === "object") {
    const n = (c as Record<string, unknown>).name ?? (c as Record<string, unknown>).caller_name
    if (typeof n === "string" && n.trim()) return n.trim()
  }
  return "Unknown lead"
}

const INTENT_TAGS: Record<string, string> = {
  emergency: "Emergency Support",
  pest_active: "Emergency Support",
  scheduling: "Scheduling Request",
  appointment: "Scheduling Request",
  quote: "Price Quote",
  billing: "Billing Inquiry",
}

function intentLabel(slug: string | null): string {
  if (!slug) return "General Inquiry"
  if (INTENT_TAGS[slug]) return INTENT_TAGS[slug]
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function LeadsWorkspaceView() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<LeadRow | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai-leads", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load leads")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setLeads(Array.isArray(data.leads) ? data.leads : [])
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="CRM" title="Leads" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <WorkspacePanel>
          <WorkspaceTableWrap>
            <thead>
              <tr>
                <WorkspaceTh>Lead name</WorkspaceTh>
                <WorkspaceTh>Contact info</WorkspaceTh>
                <WorkspaceTh>Date captured</WorkspaceTh>
                <WorkspaceTh>AI intent target</WorkspaceTh>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <WorkspaceTd colSpan={4} className="py-12 text-center text-zinc-600">
                    No leads yet
                  </WorkspaceTd>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer transition-colors hover:bg-zinc-900/50"
                    onClick={() => setSelected(lead)}
                  >
                    <WorkspaceTd className="font-medium">{leadName(lead)}</WorkspaceTd>
                    <WorkspaceTd className="text-zinc-400">{formatCaller(lead.caller_e164)}</WorkspaceTd>
                    <WorkspaceTd className="text-zinc-400">
                      {new Date(lead.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </WorkspaceTd>
                    <WorkspaceTd>
                      <IntentPill label={intentLabel(lead.intent_slug)} />
                    </WorkspaceTd>
                  </tr>
                ))
              )}
            </tbody>
          </WorkspaceTableWrap>
        </WorkspacePanel>
      )}

      <Sheet open={selected != null} onOpenChange={(o) => !o && setSelected(null)} modal>
        <SheetContent side="right" className={WORKSPACE_SHEET_CLASS}>
          {selected ? (
            <>
              <DrawerStepHeader
                step="Lead"
                title={leadName(selected)}
                subtitle={formatCaller(selected.caller_e164)}
              />
              <DrawerScrollBody>
                <IntentPill label={intentLabel(selected.intent_slug)} />
                {selected.summary ? (
                  <p className="mt-4 text-sm text-zinc-300">{selected.summary}</p>
                ) : null}
                <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-400">
                  {JSON.stringify(selected.collected, null, 2)}
                </pre>
              </DrawerScrollBody>
              <DrawerStickyFooter
                dirty={false}
                saving={false}
                onSave={() => {
                  const raw = selected.caller_e164?.trim()
                  if (raw) window.location.href = `tel:${raw}`
                }}
                onCancel={() => setSelected(null)}
                saveLabel="Follow up"
              />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  )
}
