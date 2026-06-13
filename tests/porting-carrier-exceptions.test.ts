import { describe, it, expect } from "vitest"
import {
  collectPortingExceptionTexts,
  extractLosingCarrierName,
  extractPortingCarrierRequirementLogBody,
  formatLosingCarrierRequirement,
  isWirelessPortingContext,
} from "@/lib/porting-carrier-exceptions"

describe("porting-carrier-exceptions", () => {
  it("extracts exception text and losing carrier from status.details", () => {
    const payload = {
      data: {
        record: {
          old_service_provider_ocn: "ONVOY, LLC - KY",
          porting_order_status: {
            value: "exception",
            details: [
              {
                code: "PASSCODE_PIN_INVALID",
                description: "Passcode/pin must be provided for wireless port.",
              },
            ],
          },
        },
      },
    }
    expect(extractLosingCarrierName(payload)).toBe("ONVOY, LLC - KY")
    expect(collectPortingExceptionTexts(payload)).toContain(
      "Passcode/pin must be provided for wireless port."
    )
    expect(extractPortingCarrierRequirementLogBody(payload)).toBe(
      "Losing Carrier ONVOY, LLC - KY requiring: Passcode/pin must be provided for wireless port."
    )
  })

  it("reads exceptions array and errors block", () => {
    const payload = {
      exceptions: [{ message: "Account number mismatch" }],
      errors: [{ detail: "PIN required for wireless port" }],
    }
    const texts = collectPortingExceptionTexts(payload)
    expect(texts).toContain("Account number mismatch.")
    expect(texts).toContain("PIN required for wireless port.")
    expect(formatLosingCarrierRequirement("Verizon", "PIN required for wireless port")).toBe(
      "Losing Carrier Verizon requiring: PIN required for wireless port."
    )
  })

  it("detects wireless port helper context", () => {
    expect(
      isWirelessPortingContext({
        current_carrier: "ONVOY, LLC - KY",
        carrier_rejection_reason: "Passcode/pin must be provided for wireless port.",
      })
    ).toBe(true)
    expect(isWirelessPortingContext({ current_carrier: "Comcast Business" })).toBe(false)
  })
})
