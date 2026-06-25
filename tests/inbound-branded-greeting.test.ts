import { describe, expect, it, afterEach, vi } from "vitest"
import {
  buildInboundCallerGreetingOnlyTexml,
  buildInboundGreetingContinueUrl,
  inboundGreetingPassDone,
  readInboundGreetingFirstPassEnabled,
  resolveCallerGreetingForDialPass,
} from "@/lib/inbound-branded-greeting"

describe("readInboundGreetingFirstPassEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is on by default", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "")
    expect(readInboundGreetingFirstPassEnabled()).toBe(true)
  })

  it("can be disabled with ZING_INBOUND_GREETING_FIRST=0", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "0")
    expect(readInboundGreetingFirstPassEnabled()).toBe(false)
  })
})

describe("inboundGreetingPassDone", () => {
  it("reads zingGreet=1 from query params", () => {
    const params = new URLSearchParams("zingGreet=1")
    expect(inboundGreetingPassDone(params)).toBe(true)
  })
})

describe("buildInboundCallerGreetingOnlyTexml", () => {
  it("plays Say before Redirect with no Dial", () => {
    const continueUrl = buildInboundGreetingContinueUrl("https://lyncr.app/api/voice/telnyx/incoming")
    const xml = buildInboundCallerGreetingOnlyTexml(
      "Thank you for calling Key Squad 502. Please wait while we connect your call to a team member.",
      continueUrl
    )
    expect(xml).toContain("<Say ")
    expect(xml).toContain("Key Squad 502")
    expect(xml).toContain("<Redirect")
    expect(xml).toContain("zingGreet=1")
    expect(xml).not.toContain("<Dial")
    expect(xml.indexOf("<Say")).toBeLessThan(xml.indexOf("<Redirect"))
  })
})

describe("resolveCallerGreetingForDialPass", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("omits dial greeting when two-pass mode is enabled", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "1")
    expect(resolveCallerGreetingForDialPass("Key Squad 502", false)).toBeUndefined()
  })

  it("includes dial greeting when two-pass mode is disabled", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "0")
    expect(resolveCallerGreetingForDialPass("Key Squad 502", false)).toContain("Key Squad 502")
  })
})
