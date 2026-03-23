import { describe, it, expect } from "vitest"
import { redactDigitsInString, redactDialCallbackFormFields } from "@/lib/telnyx-fallback-diagnostics"

describe("telnyx-fallback-diagnostics", () => {
  it("redacts long digit runs, keeps last 4", () => {
    expect(redactDigitsInString("+15551234567")).toBe("+***4567")
    expect(redactDigitsInString("ok")).toBe("ok")
  })

  it("redacts all form values", () => {
    const fd = new FormData()
    fd.append("To", "+15551234567")
    fd.append("DialCallDuration", "22")
    const out = redactDialCallbackFormFields(fd)
    expect(out.To).toContain("***")
    expect(out.DialCallDuration).toBe("22")
  })
})
