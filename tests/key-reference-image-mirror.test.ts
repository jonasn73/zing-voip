import { describe, expect, it } from "vitest"
import {
  isLocalKeyImageUrl,
  localKeyImagePublicPath,
  safeImageFilename,
  toAbsoluteDownloadUrl,
} from "@/lib/key-reference-image-mirror"

describe("key-reference-image-mirror", () => {
  it("detects local mirrored paths", () => {
    expect(isLocalKeyImageUrl("/key-images/CWTWB1U793/ford-3b-abc.jpg")).toBe(true)
    expect(isLocalKeyImageUrl("https://fccid.io/images/remotes/x.jpg")).toBe(false)
  })

  it("builds absolute fccid download URLs", () => {
    expect(toAbsoluteDownloadUrl("/images/remotes/test.jpg")).toBe(
      "https://fccid.io/images/remotes/test.jpg"
    )
    expect(toAbsoluteDownloadUrl("/key-images/X/a.jpg")).toBe("/key-images/X/a.jpg")
  })

  it("builds stable local public paths per FCC", () => {
    const path = localKeyImagePublicPath(
      "CWTWB1U793",
      "https://fccid.io/images/remotes/ford-hc3t-3b-image-2.jpg"
    )
    expect(path.startsWith("/key-images/CWTWB1U793/")).toBe(true)
    expect(path).toMatch(/\.jpg$/)
  })

  it("hashes filenames to avoid collisions", () => {
    const a = safeImageFilename("https://fccid.io/images/remotes/key.jpg")
    const b = safeImageFilename("https://fccid.io/images/remotes/other.jpg")
    expect(a).not.toBe(b)
  })
})
