import { afterEach, describe, expect, it } from "vitest"
import { isKeyReferenceCacheOnly } from "@/lib/key-reference-config"

describe("isKeyReferenceCacheOnly", () => {
  const prev = process.env.KEY_REFERENCE_CACHE_ONLY

  afterEach(() => {
    if (prev === undefined) delete process.env.KEY_REFERENCE_CACHE_ONLY
    else process.env.KEY_REFERENCE_CACHE_ONLY = prev
  })

  it("is false by default", () => {
    delete process.env.KEY_REFERENCE_CACHE_ONLY
    expect(isKeyReferenceCacheOnly()).toBe(false)
  })

  it("is true when env is true or 1", () => {
    process.env.KEY_REFERENCE_CACHE_ONLY = "true"
    expect(isKeyReferenceCacheOnly()).toBe(true)
    process.env.KEY_REFERENCE_CACHE_ONLY = "1"
    expect(isKeyReferenceCacheOnly()).toBe(true)
  })
})
