import { describe, expect, it } from "vitest"
import { buildInboundLineWhisperPhrase, sanitizeWhisperPhrase } from "@/lib/inbound-line-whisper"

describe("buildInboundLineWhisperPhrase", () => {
  it("uses custom label when not Main Line", () => {
    expect(buildInboundLineWhisperPhrase("Key Squad 502", "", "+15025199741")).toMatch(/Key Squad 502/)
  })

  it("falls back to friendly name when label is Main Line", () => {
    expect(buildInboundLineWhisperPhrase("Main Line", "(502) 519-9741", "+15025199741")).toMatch(/502/)
  })

  it("uses last four digits when no label or friendly name", () => {
    const s = buildInboundLineWhisperPhrase("Main Line", "", "+15025199741")
    expect(s).toMatch(/9\s+7\s+4\s+1/)
  })
})

describe("sanitizeWhisperPhrase", () => {
  it("strips script-like characters", () => {
    expect(sanitizeWhisperPhrase("A<script>x</script>")).not.toMatch(/</)
  })
})
