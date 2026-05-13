import { describe, expect, it } from "vitest"
import { buildInboundLineWhisperPhrase, sanitizeWhisperPhrase } from "@/lib/inbound-line-whisper"

describe("buildInboundLineWhisperPhrase", () => {
  it("uses custom label when not Main Line", () => {
    const s = buildInboundLineWhisperPhrase("Key Squad 502", "", "+15025199741")
    expect(s).toBe("Key Squad 502")
    expect(s).not.toMatch(/Zing/i)
  })

  it("falls back to friendly name when label is Main Line", () => {
    const s = buildInboundLineWhisperPhrase("Main Line", "(502) 519-9741", "+15025199741")
    expect(s).toBe("(502) 519-9741")
    expect(s).not.toMatch(/Zing/i)
  })

  it("uses last four digits when no label or friendly name", () => {
    const s = buildInboundLineWhisperPhrase("Main Line", "", "+15025199741")
    expect(s).toMatch(/9\s+7\s+4\s+1/)
    expect(s).not.toMatch(/Zing/i)
  })
})

describe("sanitizeWhisperPhrase", () => {
  it("strips script-like characters", () => {
    expect(sanitizeWhisperPhrase("A<script>x</script>")).not.toMatch(/</)
  })
})
