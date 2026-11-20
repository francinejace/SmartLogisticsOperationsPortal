import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { performance } from "node:perf_hooks"
import { checkChatConnection } from "../server/chat.ts"
import createLocationSearch from "../server/locations.ts"

// Opt-in: one fixed OpenAI diagnostic and one public city lookup. No database,
// user identity, customer records, chat history, secrets, or provider bodies
// are included in the saved evidence. Never run this as a load test.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const output =
  process.argv.find((value) => value.startsWith("--output="))?.slice(9) ||
  "evidence/live-services.json"
const report = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  disclosure:
    "Live outbound calls; fixed connection diagnostic and public Tarlac City query only. No workspace data sent.",
  services: [],
}
for (const service of ["openai", "geocoding"]) {
  const statuses = []
  const began = performance.now()
  const fetchImpl = async (...args) => {
    const response = await fetch(...args)
    statuses.push(response.status)
    return response
  }
  try {
    if (service === "openai") {
      assert(
        process.env.OPENAI_API_KEY?.trim(),
        "Private OpenAI key is not configured",
      )
      const result = await checkChatConnection({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL,
        signal: AbortSignal.timeout(35000),
        fetchImpl,
      })
      assert.equal(result.ok, true)
    } else {
      const search = createLocationSearch({ fetchImpl })
      const result = await search("Tarlac City")
      assert(result.locations.some((location) => location.countryCode === "PH"))
    }
    report.services.push({
      service,
      result: "passed",
      providerHttpStatuses: statuses,
      elapsedMs: +(performance.now() - began).toFixed(2),
    })
  } catch (error) {
    report.services.push({
      service,
      result: "failed",
      providerHttpStatuses: statuses,
      elapsedMs: +(performance.now() - began).toFixed(2),
      code: error.code || "verification_failed",
    })
    process.exitCode = 1
  }
}
report.result = report.services.every((row) => row.result === "passed")
  ? "passed"
  : "failed"
await mkdir(dirname(resolve(output)), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(report, null, 2))
