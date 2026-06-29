import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseFccidReplacementHtml } from "@/lib/fccid-remote-variants"

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
})
