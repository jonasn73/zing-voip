import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseFccidReplacementHtml, pickVariantsForVehicle, lookupFccRemoteVariants } from "@/lib/fccid-remote-variants"

describe("parseFccidReplacementHtml", () => {
  it("extracts Camry flip and remote head variants from HYQ12BDM page", () => {
    const html = readFileSync(
      join(process.cwd(), "tests/fixtures/fccid-hyq12bdm-snippet.html"),
      "utf8"
    )
    const variants = parseFccidReplacementHtml(html)
    expect(variants.length).toBeGreaterThan(5)

    const flip = variants.find((v) => /flip key/i.test(v.title) && /camry/i.test(v.title))
    expect(flip?.key_type).toMatch(/flip/i)
    expect(flip?.suggested_key_style).toBe("Flip key")

    const head = variants.find((v) => /remote head key/i.test(v.title) && /2014-2018 toyota camry/i.test(v.title))
    expect(head?.suggested_key_style).toBe("Remote head key")

    const withImg = variants.some((v) => Boolean(v.image_url))
    expect(withImg || flip).toBeTruthy()
  })

  it("includes Highlander photo variants from GQ4-52T listings", () => {
    const cache = JSON.parse(
      readFileSync(join(process.cwd(), "data", "fcc-remote-variants-cache.json"), "utf8")
    ) as Record<string, ReturnType<typeof parseFccidReplacementHtml>>
    const parsed = cache["GQ4-52T"] ?? []
    expect(parsed.length).toBeGreaterThan(0)
    const picked = pickVariantsForVehicle(parsed, { year: 2016, make: "TOYOTA", model: "Highlander" })
    expect(picked.some((v) => Boolean(v.image_url))).toBe(true)
  })

  it("loads bundled cache for 2017 RAV4 when KEY_REFERENCE_CACHE_ONLY is set", async () => {
    const prev = process.env.KEY_REFERENCE_CACHE_ONLY
    process.env.KEY_REFERENCE_CACHE_ONLY = "true"
    try {
      const result = await lookupFccRemoteVariants({
        fcc_id: "HYQ12BDM",
        year: 2017,
        make: "Toyota",
        model: "RAV4",
      })
      expect(result.source).toBe("lyncr-cache")
      expect(result.variants.length).toBeGreaterThan(0)
      expect(result.variants.some((v) => Boolean(v.image_url))).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.KEY_REFERENCE_CACHE_ONLY
      else process.env.KEY_REFERENCE_CACHE_ONLY = prev
    }
  })
})
