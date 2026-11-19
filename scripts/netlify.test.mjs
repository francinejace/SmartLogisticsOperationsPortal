import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import createNetlifyHandler from "../server/netlify-handler.ts"
import deployedHandler, { config } from "../netlify/functions/api.ts"
import { createBackend } from "../server/backend.ts"
import { createTestPool } from "./postgres-pool.mjs"

const origin = "https://trancelogix.netlify.app"
const adminEmail = "owner@example.com"
const adminPassword = "NetlifyAdapterTest!2026"
const context = { ip: "203.0.113.10", requestId: "netlify-test-request" }

async function fixture(t, overrides = {}) {
  const pool = await createTestPool()
  let backend
  let starts = 0
  const handler = createNetlifyHandler({
    env: {
      DATABASE_URL: "postgresql://adapter-test.invalid/workspace",
      BOOTSTRAP_ADMIN_EMAIL: adminEmail,
      BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
      // Hosted entrypoints must ignore local demo flags and filenames.
      SEED_DEMO_DATA: "true",
      DATABASE_PATH: "/not-a-hosted-database.sqlite",
      ...overrides.env,
    },
    start: async (options) => {
      starts++
      assert.equal(options.demo, false)
      assert.equal(options.secureCookies, true)
      assert.equal(options.filename, ":memory:")
      backend = await createBackend({ ...options, pool, ...overrides.backend })
      return backend
    },
  })
  t.after(async () => {
    if (backend) await backend.close()
    else await pool.end()
  })
  async function api(
    path,
    { method = "GET", body, cookie, headers = {}, ip, signal } = {},
  ) {
    const response = await handler(
      new Request(origin + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-TranceLogix-Request": "1",
          ...(method === "GET" ? {} : { Origin: origin }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === "string" ? body : JSON.stringify(body) }),
        signal,
      }),
      { ...context, ...(ip ? { ip } : {}) },
    )
    assert.match(response.headers.get("content-type"), /application\/json/)
    assert.equal(response.headers.get("cache-control"), "no-store")
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    }
  }
  async function login() {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    })
    assert.equal(result.status, 200)
    return { result, cookie: result.headers.getSetCookie()[0].split(";")[0] }
  }
  return { handler, api, login, starts: () => starts }
}

test("Netlify API paths are declared independently of the SPA fallback", () => {
  assert.deepEqual(config.path, ["/api", "/api/*"])
  assert.equal(typeof deployedHandler, "function")
  const configuration = readFileSync(
    new URL("../netlify.toml", import.meta.url),
    "utf8",
  )
  assert.match(configuration, /directory\s*=\s*"netlify\/functions"/)
  assert.match(configuration, /publish\s*=\s*"dist"/)
})

test("a missing Netlify database returns JSON without starting a local fallback", async () => {
  let started = false
  const handler = createNetlifyHandler({
    env: { SEED_DEMO_DATA: "true" },
    start: async () => {
      started = true
      throw new Error("must not start")
    },
  })
  const response = await handler(
    new Request(origin + "/api/auth/login", { method: "POST" }),
    context,
  )
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error.code, "backend_not_configured")
  assert.equal(started, false)
})

test("Netlify initialization failures are sanitized and can recover on the next invocation", async () => {
  let starts = 0
  const handler = createNetlifyHandler({
    env: { DATABASE_URL: "postgresql://adapter-test.invalid/workspace" },
    start: async () => {
      if (++starts === 1) throw new Error("private-database-diagnostic")
      return {
        handle: async (_req, res) => {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: true }))
        },
        close: async () => {},
      }
    },
  })
  const first = await handler(new Request(origin + "/api/health"), context)
  assert.equal(first.status, 503)
  assert.equal((await first.json()).error.code, "backend_unavailable")
  const second = await handler(new Request(origin + "/api/health"), context)
  assert.equal(second.status, 200)
  assert.deepEqual(await second.json(), { ok: true })
  assert.equal(starts, 2)
})

test("Netlify login, secure cookies, PostgreSQL records, origin checks and logout work through the deployed adapter", async (t) => {
  const { api, login, starts } = await fixture(t)
  const health = await api("/api/health")
  assert.equal(health.status, 200)
  assert.equal(health.body.database, "connected")
  assert.equal((await api("/api/auth/session")).body.user, null)
  assert.equal((await api("/api/v1/workspace")).status, 401)
  const badLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: "incorrect" },
  })
  assert.equal(badLogin.status, 401)
  assert.equal(badLogin.body.error.code, "invalid_credentials")
  const { result, cookie } = await login()
  const cookies = result.headers.getSetCookie()
  assert.equal(
    cookies.length,
    2,
    "new and expired legacy cookies remain separate",
  )
  assert.match(
    cookies[0],
    /^trancelogix_session=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800; Secure$/,
  )
  assert.equal(
    (await api("/api/auth/session", { cookie })).body.user.email,
    adminEmail,
  )
  const workspace = await api("/api/v1/workspace", { cookie })
  assert.equal(workspace.body.users.length, 1)
  assert.equal(
    workspace.body.orders.length,
    0,
    "hosted adapter never seeds public demo accounts or orders",
  )
  const order = await api("/api/v1/orders", {
    method: "POST",
    cookie,
    body: {
      orderId: "ORD-NETLIFY-001",
      customerId: "CUS-001",
      customer: "Netlify Test",
      destination: "Makati",
      items: [{ sku: "BOX-001", quantity: 2 }],
    },
  })
  assert.equal(order.status, 201)
  const saved = await api("/api/v1/workspace", { cookie })
  assert.equal(saved.body.orders[0].id, "ORD-NETLIFY-001")
  assert.equal(
    (
      await api("/api/auth/logout", {
        method: "POST",
        cookie,
        body: {},
        headers: { Origin: "https://other.example", Host: "other.example" },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await api("/api/auth/logout", {
        method: "POST",
        cookie,
        body: {},
        headers: { "X-TranceLogix-Request": "" },
      })
    ).status,
    403,
  )
  assert.equal(
    (await api("/api/v1/orders/ORD-NETLIFY-001", { cookie })).status,
    200,
  )
  assert.equal((await api("/api/unknown-endpoint", { cookie })).status, 404)
  const staff = await api("/api/v1/users", {
    method: "POST",
    cookie,
    body: {
      name: "Netlify Staff",
      email: "netlify-staff@example.com",
      password: "NetlifyStaffTest!2026",
      role: "Warehouse staff",
    },
  })
  assert.equal(staff.status, 201)
  const staffLogin = await api("/api/auth/login", {
    method: "POST",
    body: {
      email: "netlify-staff@example.com",
      password: "NetlifyStaffTest!2026",
    },
  })
  assert.equal(staffLogin.status, 200)
  const staffCookie = staffLogin.headers.getSetCookie()[0].split(";")[0]
  const removed = await api(`/api/v1/users/${staff.body.user.id}`, {
    method: "DELETE",
    cookie,
  })
  assert.equal(removed.status, 200)
  assert.equal(
    (await api("/api/auth/session", { cookie: staffCookie })).body.user,
    null,
  )
  assert.equal(
    (await api("/api/v1/workspace", { cookie })).body.orders[0].id,
    "ORD-NETLIFY-001",
  )
  assert.equal(
    (await api("/api/auth/logout", { method: "POST", cookie, body: {} }))
      .status,
    200,
  )
  assert.equal((await api("/api/auth/session", { cookie })).body.user, null)
  assert.equal(
    starts(),
    1,
    "warm invocations reuse one backend and database pool",
  )
})

test("Netlify rate limits use trusted context IPs rather than spoofable forwarded headers", async (t) => {
  const { api } = await fixture(t)
  for (let index = 0; index < 10; index++) {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: "incorrect" },
      headers: {
        "X-Forwarded-For": `198.51.100.${index}`,
        "X-Nf-Client-Connection-Ip": `198.51.100.${index}`,
      },
    })
    assert.equal(result.status, 401)
  }
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: { email: adminEmail, password: adminPassword },
      })
    ).status,
    429,
  )
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: { email: adminEmail, password: adminPassword },
        ip: "203.0.113.11",
      })
    ).status,
    200,
  )
})

test("Netlify preserves malformed/oversized JSON errors and forwards chat cancellation", async (t) => {
  let providerStarted
  const started = new Promise((resolve) => {
    providerStarted = resolve
  })
  const { api, login } = await fixture(t, {
    env: { OPENAI_API_KEY: "adapter-test-key-only" },
    backend: {
      fetchImpl: async (_url, options) => {
        providerStarted()
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          )
        })
      },
    },
  })
  const { cookie } = await login()
  assert.equal(
    (await api("/api/auth/login", { method: "POST", body: "{" })).status,
    400,
  )
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: { excess: "x".repeat(66000) },
      })
    ).status,
    413,
  )
  const controller = new AbortController()
  const reply = api("/api/chat", {
    method: "POST",
    cookie,
    signal: controller.signal,
    body: {
      messages: [{ role: "user", content: "How do orders work?" }],
      page: "dashboard",
    },
  })
  await started
  controller.abort()
  const stopped = await reply
  assert.equal(stopped.status, 499)
  assert.equal(stopped.body.error.code, "request_cancelled")
})
