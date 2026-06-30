// Mirror remote fccid.io key photos into public/key-images/ and rewrite the JSON cache.
// Run: npm run mirror:fcc-images
// Safe to re-run — skips files that already exist on disk.

import { copyFileSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { mirrorFccVariantCache, type MirroredVariantCache } from "../lib/key-reference-image-mirror"

const cachePath = join(process.cwd(), "data", "fcc-remote-variants-cache.json")
const publicDir = join(process.cwd(), "public")

async function main() {
  const raw = readFileSync(cachePath, "utf8")
  const cache = JSON.parse(raw) as MirroredVariantCache

  const backupPath = `${cachePath}.${Date.now()}.bak`
  copyFileSync(cachePath, backupPath)
  console.log(`Backup: ${backupPath}`)

  const { cache: mirrored, stats } = await mirrorFccVariantCache(cache, publicDir, (fccId, i, total) => {
    process.stdout.write(`\r[${i}/${total}] ${fccId}`.padEnd(60))
  })

  writeFileSync(cachePath, JSON.stringify(mirrored))
  console.log(
    `\nWrote ${cachePath} — downloaded ${stats.downloaded}, skipped ${stats.skipped}, failed ${stats.failed}, rewritten ${stats.rewritten}`
  )
}

void main()
