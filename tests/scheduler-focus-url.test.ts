import { describe, expect, it } from "vitest"
import {
  buildSchedulerFocusUrl,
  isCompleteDatetimeLocalValue,
  parseSchedulerFocusSearch,
  shouldAutoAdvanceAfterSchedulePick,
} from "@/lib/scheduler-focus-url"

describe("scheduler focus url", () => {
  it("builds focus + schedule links", () => {
    expect(buildSchedulerFocusUrl("lead-1")).toBe("/dashboard/scheduler?focus=lead-1")
    expect(buildSchedulerFocusUrl("lead-1", { schedule: true })).toBe(
      "/dashboard/scheduler?focus=lead-1&schedule=1"
    )
  })

  it("parses focus search params", () => {
    expect(parseSchedulerFocusSearch("focus=abc&schedule=1")).toEqual({
      focusLeadId: "abc",
      scheduleFromIntake: true,
    })
    expect(parseSchedulerFocusSearch("focus=abc")).toEqual({
      focusLeadId: "abc",
      scheduleFromIntake: false,
    })
  })

  it("detects complete datetime-local values", () => {
    expect(isCompleteDatetimeLocalValue("2026-06-25T14:30")).toBe(true)
    expect(isCompleteDatetimeLocalValue("2026-06-25")).toBe(false)
  })

  it("auto-advances for future days or later today", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const y = tomorrow.getFullYear()
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0")
    const d = String(tomorrow.getDate()).padStart(2, "0")
    expect(shouldAutoAdvanceAfterSchedulePick(`${y}-${m}-${d}T10:00`)).toBe(true)
  })
})
