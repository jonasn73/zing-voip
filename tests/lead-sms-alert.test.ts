import { describe, expect, it } from "vitest"
import { buildLeadAlertSmsText } from "@/lib/lead-sms-alert"

describe("buildLeadAlertSmsText", () => {
  it("formats the owner alert with vehicle and service details", () => {
    const text = buildLeadAlertSmsText({
      businessName: "Key Squad Locksmith",
      callerE164: "+15025551234",
      intentSlug: "car_key",
      collected: {
        vehicle_year: "2019",
        vehicle_make: "Honda",
        vehicle_model: "Accord",
        issue_summary: "Lost keys at grocery store parking lot",
      },
      summary: "Caller needs a spare programmed key",
    })

    expect(text).toContain("Lyncr New Lead Alert")
    expect(text).toContain("Business: Key Squad Locksmith")
    expect(text).toContain("Customer: +15025551234")
    expect(text).toContain("2019 Honda Accord")
    expect(text).toContain("Car Key")
    expect(text).toContain("Lost keys at grocery store parking lot")
  })
})
