"use client"

// Manual appointment booking modal for the owner scheduler.

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  SCHEDULER_DURATION_OPTIONS,
  SCHEDULER_JOB_TYPES,
} from "@/lib/scheduler-utils"
import type { FieldTechnician, SchedulerEvent } from "@/lib/types"

type SchedulerBookingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStart: string
  organizationId: string | null
  technicians: FieldTechnician[]
  onCreated: (event: SchedulerEvent) => void
}

const inputClass =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"

export function SchedulerBookingDialog({
  open,
  onOpenChange,
  initialStart,
  organizationId,
  technicians,
  onCreated,
}: SchedulerBookingDialogProps) {
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [jobType, setJobType] = useState<string>(SCHEDULER_JOB_TYPES[0])
  const [startLocal, setStartLocal] = useState(initialStart)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [assignedTechId, setAssignedTechId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStartLocal(initialStart)
      setError(null)
    }
  }, [open, initialStart])

  const assignableTechs = technicians.filter((t) => t.is_active && t.portal_user_id)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/owner/scheduler", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          job_type: jobType,
          scheduled_at: new Date(startLocal).toISOString(),
          duration_minutes: durationMinutes,
          assigned_tech_id: assignedTechId.trim() || null,
          organization_id: organizationId,
        }),
      })
      const json = (await res.json()) as { error?: string; data?: { event?: SchedulerEvent } }
      if (!res.ok) throw new Error(json.error ?? "Could not save appointment")
      const event = json.data?.event
      if (!event) throw new Error("No event returned")
      onCreated(event)
      setCustomerName("")
      setCustomerPhone("")
      setJobType(SCHEDULER_JOB_TYPES[0])
      setAssignedTechId("")
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save appointment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create appointment</DialogTitle>
          <DialogDescription>
            Book a job on the calendar. It appears on the hourly grid immediately after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Customer name</span>
            <input
              className={inputClass}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jane Smith"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Phone number</span>
            <input
              className={inputClass}
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(502) 555-0100"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Job type</span>
            <select className={inputClass} value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {SCHEDULER_JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Assigned tech</span>
            <select
              className={inputClass}
              value={assignedTechId}
              onChange={(e) => setAssignedTechId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignableTechs.map((t) => (
                <option key={t.id} value={t.portal_user_id!}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-foreground">Start time</span>
              <input
                className={inputClass}
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-foreground">Duration</span>
              <select
                className={inputClass}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                {SCHEDULER_DURATION_OPTIONS.map((o) => (
                  <option key={o.minutes} value={o.minutes}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !customerName.trim() || !customerPhone.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
