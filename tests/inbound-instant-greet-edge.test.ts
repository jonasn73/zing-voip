import { describe, expect, it, afterEach, vi } from "vitest"
import {
  buildEdgeInstantGreetingTexml,
  buildEdgeInboundGreetingContinueUrl,
  edgeInboundGreetingPassDone,
  shouldEdgeInstantGreetingIntercept,
} from "@/lib/inbound-instant-greet-edge"

describe("shouldEdgeInstantGreetingIntercept", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("intercepts first POST to telnyx incoming", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "1")
    const url = new URL("https://lyncr.app/api/voice/telnyx/incoming")
    expect(shouldEdgeInstantGreetingIntercept(url.pathname, url, "POST")).toBe(true)
  })

  it("passes through when zingGreet=1", () => {
    vi.stubEnv("ZING_INBOUND_GREETING_FIRST", "1")
    const url = new URL("https://lyncr.app/api/voice/telnyx/incoming?zingGreet=1")
    expect(shouldEdgeInstantGreetingIntercept(url.pathname, url, "POST")).toBe(false)
  })
})

describe("buildEdgeInstantGreetingTexml", () => {
  it("returns Say then Redirect without Dial", () => {
    const continueUrl = buildEdgeInboundGreetingContinueUrl("https://lyncr.app/api/voice/telnyx/incoming")
    const xml = buildEdgeInstantGreetingTexml(continueUrl)
    expect(xml).toContain("<Say ")
    expect(xml).toContain("Thank you for calling.")
    expect(xml).toContain("<Redirect")
    expect(edgeInboundGreetingPassDone(new URL(continueUrl))).toBe(true)
    expect(xml).not.toContain("<Dial")
  })
})
