// Build data/fcc-remote-variants-cache.json from fccid.io replacement pages.
// Run: npm run build:fcc-cache

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseFccidReplacementHtml } from "../lib/fccid-remote-variants"

function csvFccIds(): string[] {
  const filePath = join(process.cwd(), "data", "vehicle-key-fcc-reference.csv")
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/)
  const ids = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line?.trim()) continue
    const cols = line.split(",")
    const raw = cols[3]?.trim()
    if (!raw || raw === "noRecord") continue
    for (const part of raw.split("/")) {
      const clean = part.trim().replace(/\s+/g, "").toUpperCase()
      if (clean) ids.add(clean)
    }
  }
  return [...ids].sort()
}

async function fetchHtml(fccId: string): Promise<string | null> {
  const url = `https://fccid.io/${encodeURIComponent(fccId)}/Remote-Keyfob-Replacement`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; lyncr-key-cache/1.0; +https://lyncr.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.includes("remote-key-thumb") ? html : null
  } catch {
    return null
  }
}

async function main() {
  const fccIds = csvFccIds()
  const out: Record<string, ReturnType<typeof parseFccidReplacementHtml>> = {}
  let ok = 0
  let fail = 0

  for (let i = 0; i < fccIds.length; i++) {
    const fccId = fccIds[i]!
    process.stdout.write(`[${i + 1}/${fccIds.length}] ${fccId} … `)
    const html = await fetchHtml(fccId)
    if (!html) {
      fail++
      console.log("skip")
      await new Promise((r) => setTimeout(r, 150))
      continue
    }
    const parsed = parseFccidReplacementHtml(html)
    out[fccId] = parsed
    ok++
    console.log(`${parsed.length} variants`)
    await new Promise((r) => setTimeout(r, 150))
  }

  const outPath = join(process.cwd(), "data", "fcc-remote-variants-cache.json")
  writeFileSync(outPath, JSON.stringify(out))
  console.log(`\nWrote ${outPath} — ${ok} FCC IDs cached, ${fail} skipped`)
}

void main()
