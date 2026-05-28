import { describe, expect, it } from "vitest"
import {
  calculateReceptionistPay,
  calculateReceptionistPayTotal,
  isAnsweredReceptionistCall,
  resolveReceptionistLegDurationSeconds,
} from "@/lib/receptionist-pay"

describe("receptionist-pay", () => {
  it("treats completed and answered as payable", () => {
    expect(isAnsweredReceptionistCall("completed")).toBe(true)
    expect(isAnsweredReceptionistCall("Answered")).toBe(true)
    expect(isAnsweredReceptionistCall("no-answer")).toBe(false)
  })

  it("prefers answered_at to ended_at for duration", () => {
    const seconds = resolveReceptionistLegDurationSeconds({
      answered_at: "2026-05-01T12:00:00.000Z",
      ended_at: "2026-05-01T12:02:30.000Z",
      duration_seconds: 10,
    })
    expect(seconds).toBe(150)
  })

  it("FLAT_RATE pays 2.50 per answered call", () => {
    expect(
      calculateReceptionistPay({
        durationInSeconds: 0,
        payMode: "FLAT_RATE",
        flatRateUsd: 2.5,
        isAnswered: true,
      })
    ).toBe(2.5)
  })

  it("PER_MINUTE pays duration * rate", () => {
    expect(
      calculateReceptionistPay({
        durationInSeconds: 120,
        payMode: "PER_MINUTE",
        ratePerMinute: 0.25,
        isAnswered: true,
      })
    ).toBe(0.5)
  })

  it("aggregates FLAT_RATE across calls", () => {
    expect(
      calculateReceptionistPayTotal({
        payMode: "FLAT_RATE",
        flatRateUsd: 2.5,
        answeredCalls: 4,
        totalTalkSeconds: 900,
      })
    ).toBe(10)
  })
})
