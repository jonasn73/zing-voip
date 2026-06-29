import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  assertMustResolveVehicleKeys,
  EXPECTED_KEY_LOOKUP_MISSES,
  runVehicleKeyCoverageAudit,
  type VehicleKeyCoverageCase,
} from "@/lib/vehicle-key-coverage-audit"
import { lookupVehicleKeyProfiles } from "@/lib/vehicle-key-reference"

type CoverageFixture = {
  minimum_hit_rate: number
  samples: VehicleKeyCoverageCase[]
  stats_at_generation?: { hit_rate?: number; sample_misses?: string[] }
}

function loadFixture(): CoverageFixture {
  const raw = readFileSync(join(process.cwd(), "tests/fixtures/vehicle-key-nhtsa-coverage.json"), "utf8")
  return JSON.parse(raw) as CoverageFixture
}

describe("vehicle key FCC coverage (NHTSA vs reference DB)", () => {
  it("resolves all must-hit locksmith vehicles", () => {
    const failures = assertMustResolveVehicleKeys()
    expect(failures, `Missing FCC data for: ${failures.join(", ")}`).toEqual([])
  })

  it("keeps expected gaps empty for brands not in open reference data", () => {
    for (const c of EXPECTED_KEY_LOOKUP_MISSES) {
      const result = lookupVehicleKeyProfiles(String(c.year), c.make, c.model)
      expect(result).toBeNull()
    }
  })

  it("meets minimum hit rate on filtered NHTSA sample fixture", () => {
    const fixture = loadFixture()
    const report = runVehicleKeyCoverageAudit(fixture.samples)
    expect(report.hit_rate).toBeGreaterThanOrEqual(fixture.minimum_hit_rate)
    if (report.miss_list.length > 0 && report.hit_rate < fixture.minimum_hit_rate + 0.02) {
      console.warn(
        "Key lookup misses (sample):",
        report.miss_list.slice(0, 20).join("; "),
        "\nRefresh fixture: npm run audit:vehicle-keys"
      )
    }
  })
})
