import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { LEGACY_BRAND_KEY } from "../src/brand.ts"

export default function localDatabasePath(root: string, configured?: string) {
  if (configured) return resolve(root, configured)
  const legacy = resolve(root, `.data/${LEGACY_BRAND_KEY}.sqlite`)
  // Continue using an existing database so a branding change cannot hide saved work.
  return existsSync(legacy) ? legacy : resolve(root, ".data/trancelogix.sqlite")
}
