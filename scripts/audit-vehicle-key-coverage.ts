#!/usr/bin/env npx tsx
// Refresh tests/fixtures/vehicle-key-nhtsa-coverage.json from live NHTSA + local FCC reference.
// Run: npm run audit:vehicle-keys

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { fetchModelsForMakeYear } from "@/lib/nhtsa-vpic"
import {
  EXPECTED_KEY_LOOKUP_MISSES,
  isLocksmithRelevantNhtsaModel,
  LOCKSMITH_COVERAGE_MAKES,
  MUST_RESOLVE_VEHICLE_KEYS,
  runVehicleKeyCoverageAudit,
  type VehicleKeyCoverageCase,
} from "@/lib/vehicle-key-coverage-audit"

const YEARS = [2012, 2014, 2016, 2017, 2018, 2019, 2020, 2022, 2024]
const MODELS_PER_MAKE_YEAR = 50

async function main() {
  const samples: VehicleKeyCoverageCase[] = []

  for (const c of MUST_RESOLVE_VEHICLE_KEYS) {
    samples.push({ ...c, expect: "resolve" })
  }
  for (const c of EXPECTED_KEY_LOOKUP_MISSES) {
    samples.push({ ...c, expect: "miss_ok" })
  }

  for (const year of YEARS) {
    for (const make of LOCKSMITH_COVERAGE_MAKES) {
      const models = await fetchModelsForMakeYear(make, year)
      const relevant = models.filter(isLocksmithRelevantNhtsaModel).slice(0, MODELS_PER_MAKE_YEAR)
      for (const model of relevant) {
        if (samples.some((s) => s.year === year && s.make === make && s.model === model)) continue
        samples.push({ year, make, model, expect: "resolve" })
      }
    }
  }

  const report = runVehicleKeyCoverageAudit(samples)
  const minimum_hit_rate = Math.max(0.5, Math.round((report.hit_rate - 0.05) * 100) / 100)

  const fixture = {
    generated_at: new Date().toISOString(),
    description:
      "Filtered NHTSA YMM samples for locksmith FCC lookup coverage. Refresh: npm run audit:vehicle-keys",
    minimum_hit_rate,
    must_resolve: MUST_RESOLVE_VEHICLE_KEYS,
    miss_ok: EXPECTED_KEY_LOOKUP_MISSES,
    samples,
    stats_at_generation: {
      total_resolve_expected: report.total,
      hits: report.hits,
      misses: report.misses,
      hit_rate: Math.round(report.hit_rate * 1000) / 1000,
      sample_misses: report.miss_list.slice(0, 30),
    },
  }

  const outPath = join(process.cwd(), "tests/fixtures/vehicle-key-nhtsa-coverage.json")
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`)
  console.log(`Wrote ${outPath}`)
  console.log(
    `Coverage: ${report.hits}/${report.total} (${(report.hit_rate * 100).toFixed(1)}%) — CI threshold ${(minimum_hit_rate * 100).toFixed(0)}%`
  )
  if (report.miss_list.length) {
    console.log("Sample misses:\n", report.miss_list.slice(0, 15).join("\n"))
  }
}

void main()
