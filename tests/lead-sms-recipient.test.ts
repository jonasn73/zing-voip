import { describe, expect, it } from "vitest"
import { resolveLeadAlertSmsRecipient } from "@/lib/lead-sms-recipient"

describe("resolveLeadAlertSmsRecipient", () => {
  it("prefers dispatch_sms_phone over notification_phone", () => {
    const result = resolveLeadAlertSmsRecipient(
      { dispatch_sms_phone: "+15551112222", notification_phone: "+15553334444" },
      { phone: "+15556667777" }
    )
    expect(result).toBe("+15551112222")
  })

  it("falls back to notification_phone then profile phone", () => {
    expect(
      resolveLeadAlertSmsRecipient({ dispatch_sms_phone: null, notification_phone: "+15553334444" }, { phone: "+15556667777" })
    ).toBe("+15553334444")
    expect(resolveLeadAlertSmsRecipient({ dispatch_sms_phone: null, notification_phone: null }, { phone: "+15556667777" })).toBe(
      "+15556667777"
    )
  })
})

describe("automotive_core certification data", () => {
  it("includes locksmith intake quiz topics", async () => {
    const { certificationsData } = await import("@/lib/data/certifications")
    const entry = certificationsData.find((c) => c.certification_code === "automotive_core")
    expect(entry?.questions.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4"])
    expect(entry?.questions.some((q) => q.question.includes("AKL"))).toBe(true)
  })
})
