import assert from "node:assert/strict"
import { createServer, request as httpRequest, Agent } from "node:http"
import { fork, execFileSync } from "node:child_process"
import { cpus, totalmem, platform, release, arch } from "node:os"
import { performance } from "node:perf_hooks"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createBackend } from "../server/backend.ts"

// Never reads .env files. All provider traffic is replaced by a local fixture.
if (process.argv.includes("--fixture")) {
  let fault = "healthy",
    externalCalls = 0
  const backend = await createBackend({
    filename: ":memory:",
    demo: true,
    apiKey: "synthetic-validation-credential",
    fetchImpl: async (url, init) => {
      const target = new URL(url)
      assert(
        ["api.openai.com", "geocoding-api.open-meteo.com"].includes(
          target.hostname,
        ),
      )
      externalCalls++
      if (fault === "timeout")
        return new Promise((_, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          )
        })
      if (fault === "http_error")
        return Response.json(
          { error: { message: "SYNTHETIC_PRIVATE_UPSTREAM_DETAIL" } },
          { status: 500 },
        )
      if (fault === "invalid_json")
        return new Response("{invalid-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      if (fault === "malformed_shape")
        return Response.json(
          target.hostname === "api.openai.com"
            ? { output: "invalid" }
            : { results: "invalid" },
        )
      return Response.json(
        target.hostname === "api.openai.com"
          ? {
              status: "completed",
              output: [
                {
                  type: "message",
                  content: [
                    {
                      type: "output_text",
                      text: "Open Orders and select Create order.",
                    },
                  ],
                },
              ],
            }
          : {
              results: [
                {
                  id: 1684138,
                  name: "Tarlac City",
                  latitude: 15.4802,
                  longitude: 120.5979,
                  feature_code: "PPLA2",
                  country: "Philippines",
                  country_code: "PH",
                  admin1: "Central Luzon",
                },
              ],
            },
      )
    },
  })
  const server = createServer((req, res) => void backend.handle(req, res))
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  process.send({ ready: true, port: server.address().port })
  process.on("message", (message) => {
    if (message.fault) fault = message.fault
    process.send?.({
      id: message.id,
      cpu: process.cpuUsage(),
      rssBytes: process.memoryUsage().rss,
      externalCalls,
    })
  })
  const stop = async () => {
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
    await backend.close()
    process.exit(0)
  }
  process.on("SIGTERM", () => void stop())
  process.on("disconnect", () => void stop())
} else {
  const child = fork(fileURLToPath(import.meta.url), ["--fixture"], {
    execArgv: ["--experimental-strip-types"],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  })
  const ready = await new Promise((done, reject) => {
    child.once("message", done)
    child.once("error", reject)
    child.once("exit", (code) => reject(new Error("Fixture exited: " + code)))
  })
  const origin = "http://127.0.0.1:" + ready.port
  // node:http avoids an Undici socket-priority crash seen when aborting many
  // concurrent fetches on this macOS/Node runtime. Keep client faults distinct.
  const loadAgent = new Agent({ keepAlive: true, maxSockets: 200 })
  function loadRequest() {
    return new Promise((done, reject) => {
      let expired = false
      const failure = (error) => {
        clearTimeout(timer)
        reject(
          expired
            ? Object.assign(new Error("Client deadline"), {
                code: "CLIENT_DEADLINE",
              })
            : error,
        )
      }
      const request = httpRequest(
        origin + "/api/v1/workspace",
        {
          agent: loadAgent,
          headers: { Cookie: cookie },
        },
        (response) => {
          response.resume()
          response.once("end", () => {
            clearTimeout(timer)
            done(response.statusCode)
          })
          response.once("error", failure)
        },
      )
      const timer = setTimeout(() => {
        expired = true
        request.destroy(
          Object.assign(new Error("Client deadline"), {
            code: "CLIENT_DEADLINE",
          }),
        )
      }, 2000)
      request.once("error", failure)
      request.end()
    })
  }
  const output =
    process.argv.find((value) => value.startsWith("--output="))?.slice(9) ||
    "evidence/integration-validation.json"
  const command = async (fault) => {
    const id = crypto.randomUUID()
    return new Promise((done) => {
      const handler = (message) => {
        if (message.id === id) {
          child.off("message", handler)
          done(message)
        }
      }
      child.on("message", handler)
      child.send({ id, ...(fault ? { fault } : {}) })
    })
  }
  let cookie = ""
  async function api(
    path,
    body,
    method = body === undefined ? "GET" : "POST",
    deadline = 40000,
  ) {
    const start = performance.now()
    const response = await fetch(origin + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-TranceLogix-Request": "1",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(deadline),
    })
    const json = await response.json()
    return {
      status: response.status,
      elapsedMs: +(performance.now() - start).toFixed(2),
      body: json,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    }
  }
  const report = {
    recordedAt: new Date().toISOString(),
    clientDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(new Date()),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    environment: {
      node: process.version,
      platform: platform(),
      osRelease: release(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      ramGiB: +(totalmem() / 2 ** 30).toFixed(2),
      database: "in-memory SQLite, seeded synthetic records",
      topology:
        "separate load-generator and server processes on one host, loopback HTTP",
      externalRequests: 0,
    },
    methodology: {
      endpoint: "GET /api/v1/workspace as Administrator",
      client: "node:http with keep-alive, 200 sockets maximum",
      variable: "closed-loop concurrent clients",
      durationPerStageMs: 5000,
      requestDeadlineMs: 2000,
      degradationCriterion:
        "p95 > 500 ms OR failed requests > 1%; validation threshold, not a production SLA",
      providerTimeoutsMs: { openai: 30000, geocoding: 7000 },
      limitations: [
        "Small seeded dataset",
        "No TLS or WAN latency in loopback test",
        "Load generator shares host resources",
        "Not a hosted PostgreSQL capacity measurement",
        "External providers are injected fixtures, not load tested",
      ],
    },
    load: [],
    reliability: [],
    workflow: [],
    assertions: [],
  }
  try {
    const login = await api("/api/auth/login", {
      email: "admin@trancelogix.local",
      password: "TranceLogixDemo!2026",
    })
    assert.equal(login.status, 200)
    cookie = login.cookie
    const baseline = (await api("/api/v1/workspace")).body
    report.environment.records = {
      orders: baseline.orders.length,
      shipments: baseline.shipments.length,
      users: baseline.users.length,
    }
    for (let index = 0; index < 10; index++) await api("/api/v1/workspace")
    for (const concurrency of [1, 5, 10, 25, 50, 100, 200]) {
      const before = await command()
      const durations = [],
        statuses = {},
        failures = {},
        networkCodes = {}
      const start = performance.now(),
        end = start + 5000
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (performance.now() < end) {
            const began = performance.now()
            try {
              const status = await loadRequest()
              statuses[status] = (statuses[status] || 0) + 1
            } catch (error) {
              const kind =
                error.code === "CLIENT_DEADLINE"
                  ? "client_deadline"
                  : "client_network"
              failures[kind] = (failures[kind] || 0) + 1
              if (kind === "client_network")
                networkCodes[error.code || error.name] =
                  (networkCodes[error.code || error.name] || 0) + 1
            }
            durations.push(performance.now() - began)
          }
        }),
      )
      const elapsedMs = performance.now() - start
      const after = await command()
      durations.sort((a, b) => a - b)
      const percentile = (fraction) =>
        +(
          durations[Math.max(0, Math.ceil(durations.length * fraction) - 1)] ||
          0
        ).toFixed(2)
      const success = statuses[200] || 0
      const failed = durations.length - success
      const stage = {
        concurrency,
        requests: durations.length,
        success,
        failed,
        errorPct: +((100 * failed) / durations.length).toFixed(2),
        elapsedMs: +elapsedMs.toFixed(2),
        successfulRps: +((success * 1000) / elapsedMs).toFixed(2),
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
        statuses,
        failures,
        networkCodes,
        serverCpuOneCorePct: +(
          ((after.cpu.user -
            before.cpu.user +
            after.cpu.system -
            before.cpu.system) /
            1000 /
            elapsedMs) *
          100
        ).toFixed(2),
        serverRssMiB: +(after.rssBytes / 2 ** 20).toFixed(2),
      }
      stage.degraded = stage.p95Ms > 500 || stage.errorPct > 1
      report.load.push(stage)
      console.log("LOAD", JSON.stringify(stage))
    }
    report.firstDegradation =
      report.load.find((stage) => stage.degraded)?.concurrency ?? null
    report.firstDeadlineFailure =
      report.load.find((stage) => stage.failures.client_deadline)
        ?.concurrency ?? null
    await command("healthy")
    await api("/api/health")
    for (const service of ["openai", "geocoding"]) {
      for (const fault of [
        "timeout",
        "http_error",
        "invalid_json",
        "malformed_shape",
      ]) {
        await command(fault)
        const query = "Validation " + fault
        const path =
          service === "openai"
            ? "/api/chat"
            : "/api/v1/locations?city=" + encodeURIComponent(query)
        const body =
          service === "openai"
            ? {
                page: "orders",
                messages: [
                  { role: "user", content: "How do I create an order?" },
                ],
              }
            : undefined
        const pendingFailure = api(path, body)
        // Also measure core access while a slow provider request is still pending.
        await new Promise((done) => setTimeout(done, 25))
        const duringFailure = await api("/api/v1/workspace")
        const failed = await pendingFailure
        assert.equal(failed.status, fault === "timeout" ? 504 : 502)
        assert(!JSON.stringify(failed.body).includes("SYNTHETIC_PRIVATE"))
        const stillAvailable = await api("/api/v1/workspace")
        assert.equal(stillAvailable.status, 200)
        assert.deepEqual(stillAvailable.body.orders, baseline.orders)
        assert.deepEqual(stillAvailable.body.shipments, baseline.shipments)
        await command("healthy")
        const recovered = await api(path, body)
        assert.equal(recovered.status, 200)
        assert.equal(duringFailure.status, 200)
        const row = {
          service,
          fault,
          failureStatus: failed.status,
          errorCode: failed.body.error.code,
          failureElapsedMs: failed.elapsedMs,
          workspaceDuringFaultRequestStatus: duringFailure.status,
          workspaceDuringFaultRequestMs: duringFailure.elapsedMs,
          workspaceWhileProviderFaultedStatus: stillAvailable.status,
          workspaceElapsedMs: stillAvailable.elapsedMs,
          recoveryStatus: recovered.status,
          recoveryElapsedMs: recovered.elapsedMs,
          recoveryMode:
            "next explicit request after fixture restored; no background retry",
          dataPreserved: true,
        }
        report.reliability.push(row)
        console.log("FAULT", JSON.stringify(row))
      }
    }
    // AWS retry/idempotency lesson becomes an executable release acceptance gate.
    const body = { orderId: "ORD-1005", carrier: "LBC Express" }
    const unknown = await api("/api/v1/shipments", {
      ...body,
      simulation: "timeout",
    })
    assert.equal(unknown.status, 409)
    const blocked = await api("/api/v1/shipments", body)
    assert.equal(blocked.body.error.code, "outcome_unknown")
    const checked = await api("/api/v1/carrier/check", {
      orderId: body.orderId,
    })
    assert.equal(checked.status, 200)
    const created = await api("/api/v1/shipments", {
      ...body,
      simulation: "sync_failure",
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.shipment.sync, "Pending")
    const replay = await api("/api/v1/shipments", body)
    assert.equal(replay.status, 200)
    assert.equal(replay.body.shipment.id, created.body.shipment.id)
    const synced = await api(
      "/api/v1/shipments/" + created.body.shipment.id + "/sync",
      {},
    )
    assert.equal(synced.body.shipment.sync, "Synchronized")
    const final = (await api("/api/v1/workspace")).body
    assert.equal(
      final.shipments.filter((row) => row.orderId === body.orderId).length,
      1,
    )
    report.workflow = [
      {
        operation: "simulated carrier timeout",
        status: unknown.status,
        elapsedMs: unknown.elapsedMs,
        persistedOutcome: "unknown",
        realNetworkTimeout: false,
      },
      {
        operation: "unsafe replay blocked",
        status: blocked.status,
        elapsedMs: blocked.elapsedMs,
      },
      {
        operation: "explicit carrier status check",
        status: checked.status,
        elapsedMs: checked.elapsedMs,
      },
      {
        operation: "carrier confirmed, simulated OMS failure",
        status: created.status,
        elapsedMs: created.elapsedMs,
        sync: "Pending",
      },
      {
        operation: "idempotent shipment replay",
        status: replay.status,
        elapsedMs: replay.elapsedMs,
        sameShipment: true,
      },
      {
        operation: "OMS-only recovery",
        status: synced.status,
        elapsedMs: synced.elapsedMs,
        sameShipment: true,
        sync: "Synchronized",
        shipmentsForOrder: 1,
      },
    ]
    report.assertions = [
      "Provider failures are sanitized",
      "Workspace GET remains available with provider failure injected",
      "External-provider failures do not mutate orders or shipments",
      "Restored providers recover on the next explicit request",
      "Unknown carrier outcome blocks blind retry",
      "Replay returns the same shipment",
      "OMS-only recovery preserves exactly one shipment",
    ]
    report.result = "passed"
  } catch (error) {
    report.result = "failed"
    report.failure = { name: error.name, message: error.message }
    process.exitCode = 1
  } finally {
    loadAgent.destroy()
    await mkdir(dirname(resolve(output)), { recursive: true })
    await writeFile(output, JSON.stringify(report, null, 2) + "\n")
    child.kill("SIGTERM")
    await new Promise((done) => child.once("exit", done))
    console.log("Evidence:", output, report.result)
  }
}
