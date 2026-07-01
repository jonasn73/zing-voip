import { describe, expect, it } from "vitest"
import {
  formatSchedulerJobCountdown,
  resolveSchedulerJobUrgency,
} from "@/lib/scheduler-job-urgency"

describe("scheduler job urgency", () => {
  const now = new Date("2026-07-01T12:43:00-04:00")

  it("flags jobs within 30 minutes as imminent", () => {
    expect(
      resolveSchedulerJobUrgency({
        now,
        scheduled_at: "2026-07-01T13:10:00-04:00",
        phase: "unassigned",
      })
    ).toBe("imminent")
  })

  it("flags jobs 31–90 minutes out as soon", () => {
    expect(
      resolveSchedulerJobUrgency({
        now,
        scheduled_at: "2026-07-01T13:30:00-04:00",
        phase: "unassigned",
      })
    ).toBe("soon")
  })

  it("flags past jobs as overdue", () => {
    expect(
      resolveSchedulerJobUrgency({
        now,
        scheduled_at: "2026-07-01T12:00:00-04:00",
        phase: "scheduled",
      })
    ).toBe("overdue")
  })

  it("formats countdown until start", () => {
    expect(formatSchedulerJobCountdown(now, "2026-07-01T13:30:00-04:00")).toBe("In 47m")
  })
})
