import { describe, expect, it } from "vitest"
import { filterInboundBusinessLines, lineMatchesOwnerCell } from "@/lib/owner-cell-line-filter"

describe("owner-cell-line-filter", () => {
  it("detects when a line duplicates the owner cell", () => {
    expect(lineMatchesOwnerCell("+15022602716", "+1 (502) 260-2716")).toBe(true)
    expect(lineMatchesOwnerCell("+15025571219", "+15022602716")).toBe(false)
  })

  it("drops owner cell mirror when a real inbound line exists", () => {
    const lines = [
      { number: "+15022602716", label: "Key Squad line" },
      { number: "+15025571219", label: "Key Squad main line" },
    ]
    const filtered = filterInboundBusinessLines(lines, "+15022602716")
    expect(filtered.map((l) => l.number)).toEqual(["+15025571219"])
  })
})
