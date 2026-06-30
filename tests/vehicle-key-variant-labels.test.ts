import { describe, expect, it } from "vitest"
import { classifyKeyStyleBucket, variantDisplayLabel } from "@/lib/vehicle-key-variant-labels"

describe("vehicle-key-variant-labels", () => {
  it("labels key combo as remote head key, not generic remote", () => {
    expect(
      variantDisplayLabel("2017 Nissan Altima Keyless Entry Remote / key combo", null)
    ).toBe("Remote head key")
    expect(classifyKeyStyleBucket("2017 Nissan Altima Keyless Entry Remote / key combo", null)).toBe(
      "remote_head"
    )
  })

  it("labels smart remote key fob as smart even when type says Remote", () => {
    expect(variantDisplayLabel("2016 Dodge Dart Smart Remote Key Fob - Refurbished", "Remote")).toBe(
      "Smart key"
    )
  })

  it("labels standalone keyless remote as keyless fob", () => {
    expect(variantDisplayLabel("2016 Dodge Dart Keyless Remote Key - Refurbished", null)).toBe(
      "Keyless fob"
    )
  })
})
