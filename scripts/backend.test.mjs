import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createBackend } from "../server/backend.ts"
import { createTestPool } from "./postgres-pool.mjs"

test("pre-parsed Vercel request bodies support authenticated mutations", async t => {
  const { api, login } = await fixture(t, { parsedBody: true })
  const cookie = await login()
  const result = await api("/api/v1/orders", { method: "POST", cookie, body: { orderId: "ORD-PARSED-001", customerId: "CUS-001", destination: "Tarlac", items: [{ sku: "BOX-001", quantity: 1 }] } })
  assert.equal(result.status, 201)
  assert.equal(result.body.order.id, "ORD-PARSED-001")
})

test("concurrent shipment submissions create one saved shipment", async (t) => {
  const { api, login } = await fixture(t)
  const cookie = await login()
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      api("/api/v1/shipments", {
        method: "POST",
        cookie,
        body: { orderId: "ORD-1005", carrier: "LBC Express" },
      }),
    ),
  )
  assert.equal(results.filter((result) => result.status === 201).length, 1)
  assert.equal(results.filter((result) => result.status === 200).length, 3)
  assert.equal(
    new Set(results.map((result) => result.body.shipment.id)).size,
    1,
  )
})

async function fixture(t, options = {}) {
  if (
    process.env.TRANSLOGIX_TEST_POSTGRES === "1" &&
    options.filename === undefined
  ) {
    options = { ...options, pool: await createTestPool() }
  }
  const backend = await createBackend({
    filename: ":memory:",
    demo: true,
    ...options,
  })
  const server = createServer(async (req, res) => {
    if (options.parsedBody && req.method !== "GET") {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    }
    await backend.handle(req, res)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await backend.close()
  })
  async function api(
    path,
    { method = "GET", body, cookie, headers = {} } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-TransLogix-Request": "1",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie"),
      headers: response.headers,
    }
  }
  async function login(account = "operations") {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: `${account}@translogix.local`,
        password: "TransLogixDemo!2026",
      },
    })
    assert.equal(result.status, 200)
    return result.cookie.split(";")[0]
  }
  return { api, login }
}

test("authentication, cookies, request origin, and server-enforced roles", async (t) => {
  const { api, login } = await fixture(t)
  assert.equal((await api("/api/v1/workspace")).status, 401)
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: {},
        headers: { Origin: "https://other.example" },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: {},
        headers: { "X-TransLogix-Request": "" },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await api("/api/auth/login", {
        method: "POST",
        body: { email: "operations@translogix.local", password: "wrong" },
      })
    ).status,
    401,
  )
  const cookie = await login("warehouse")
  const snapshot = await api("/api/v1/workspace", { cookie })
  assert.equal(snapshot.body.user.role, "Warehouse staff")
  assert.equal(snapshot.body.users.length, 0)
  assert(snapshot.body.activity.every((event) => event.details === undefined))
  assert(!JSON.stringify(snapshot.body).includes("password_hash"))
  assert.equal(
    (await api("/api/v1/orders", { method: "POST", cookie, body: {} })).status,
    403,
  )
  assert.equal(
    (await api("/api/v1/users", { method: "POST", cookie, body: {} })).status,
    403,
  )
  const admin = await login("admin")
  const created = await api("/api/v1/users", {
    method: "POST",
    cookie: admin,
    body: {
      name: "Test User",
      email: "test@example.com",
      role: "Operations staff",
      password: "AnotherPassword!2026",
    },
  })
  assert.equal(created.status, 201)
  assert.equal(
    (
      await api("/api/v1/users/usr-admin/role", {
        method: "PATCH",
        cookie: admin,
        body: { role: "Warehouse staff" },
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await api("/api/v1/users/usr-warehouse/role", {
        method: "PATCH",
        cookie: admin,
        body: { role: "Operations staff" },
      })
    ).status,
    200,
  )
  assert.equal(
    (await api("/api/v1/workspace", { cookie })).status,
    401,
    "role change revokes old sessions",
  )
  const logout = await api("/api/auth/logout", {
    method: "POST",
    cookie: admin,
    body: {},
  })
  assert.match(logout.cookie, /HttpOnly; SameSite=Strict/)
  assert.equal((await api("/api/v1/workspace", { cookie: admin })).status, 401)
})

test("validated orders, preparation prerequisites, durable shipments, idempotency, tracking and safe OMS retry", async (t) => {
  const { api, login } = await fixture(t)
  const cookie = await login()
  const order = {
    orderId: "ORD-1010",
    customerId: "CUS-001",
    customer: "Test customer",
    destination: "Tarlac",
    items: [{ sku: "BOX-001", quantity: 2 }],
  }
  assert.equal(
    (
      await api("/api/v1/orders", {
        method: "POST",
        cookie,
        body: { ...order, items: [{ sku: "BOX-001", quantity: 0 }] },
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await api("/api/v1/orders", {
        method: "POST",
        cookie,
        body: { ...order, items: [{ sku: "MISSING", quantity: 2 }] },
      })
    ).status,
    400,
  )
  const created = await api("/api/v1/orders", {
    method: "POST",
    cookie,
    body: order,
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.order.inventory, "Not checked")
  assert.equal(
    (await api("/api/v1/orders", { method: "POST", cookie, body: order }))
      .status,
    409,
  )
  const shipmentBody = {
    orderId: "ORD-1010",
    carrier: "LBC Express",
    simulation: "sync_failure",
  }
  assert.equal(
    (
      await api("/api/v1/shipments", {
        method: "POST",
        cookie,
        body: shipmentBody,
      })
    ).body.error.code,
    "prerequisites_incomplete",
  )
  assert.equal(
    (
      await api("/api/v1/inventory/check", {
        method: "POST",
        cookie,
        body: { orderId: "ORD-1010" },
      })
    ).body.available,
    true,
  )
  assert.equal(
    (
      await api("/api/v1/inventory/check", {
        method: "POST",
        cookie,
        body: { orderId: "ORD-1003" },
      })
    ).body.available,
    false,
  )
  const preparation = {
    picked: true,
    packed: true,
    weight: 2.5,
    notes: "Fragile",
    shortage: false,
  }
  assert.equal(
    (
      await api("/api/v1/orders/ORD-1010/preparation", {
        method: "PUT",
        cookie,
        body: { ...preparation, weight: -1 },
      })
    ).status,
    400,
  )
  await api("/api/v1/orders/ORD-1010/preparation", {
    method: "PUT",
    cookie,
    body: { ...preparation, shortage: true },
  })
  assert.equal(
    (
      await api("/api/v1/shipments", {
        method: "POST",
        cookie,
        body: shipmentBody,
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await api("/api/v1/orders/ORD-1010/preparation", {
        method: "PUT",
        cookie,
        body: preparation,
      })
    ).status,
    200,
  )
  const shipment = await api("/api/v1/shipments", {
    method: "POST",
    cookie,
    body: shipmentBody,
  })
  assert.equal(shipment.status, 201)
  assert.equal(shipment.body.shipment.sync, "Pending")
  assert.equal(shipment.body.shipment.status, "Label created")
  const replay = await api("/api/v1/shipments", {
    method: "POST",
    cookie,
    body: shipmentBody,
  })
  assert.equal(replay.status, 200)
  assert.equal(replay.body.shipment.id, shipment.body.shipment.id)
  assert.equal(replay.body.replay, true)
  assert.equal(
    (
      await api("/api/v1/orders/ORD-1010/preparation", {
        method: "PUT",
        cookie,
        body: preparation,
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await api(`/api/v1/shipments/${shipment.body.shipment.id}/sync`, {
        method: "POST",
        cookie,
        body: {},
      })
    ).body.shipment.sync,
    "Synchronized",
  )
  for (const reference of [
    "ORD-1010",
    shipment.body.shipment.id,
    shipment.body.shipment.tracking,
  ]) {
    const tracked = await api(`/api/v1/tracking?reference=${reference}`, {
      cookie,
    })
    assert.equal(tracked.status, 200)
    assert.equal(tracked.body.shipment.status, "Label created")
  }
  const snapshot = (await api("/api/v1/workspace", { cookie })).body
  assert.equal(
    snapshot.shipments.filter((row) => row.orderId === "ORD-1010").length,
    1,
  )
  assert(
    snapshot.activity.some(
      (row) =>
        row.title === "Preparation saved" && row.reference === "ORD-1010",
    ),
  )
})

test("unknown carrier outcomes block retries until a persisted status check", async (t) => {
  const { api, login } = await fixture(t)
  const cookie = await login()
  const body = {
    orderId: "ORD-1005",
    carrier: "LBC Express",
    simulation: "timeout",
  }
  assert.equal(
    (await api("/api/v1/shipments", { method: "POST", cookie, body })).body
      .error.code,
    "outcome_unknown",
  )
  assert.equal(
    (
      await api("/api/v1/shipments", {
        method: "POST",
        cookie,
        body: { ...body, simulation: "success" },
      })
    ).body.error.code,
    "outcome_unknown",
  )
  const check = await api("/api/v1/carrier/check", {
    method: "POST",
    cookie,
    body: { orderId: body.orderId },
  })
  assert.equal(check.body.outcome, "not_created")
  assert.equal(
    (
      await api("/api/v1/shipments", {
        method: "POST",
        cookie,
        body: { ...body, simulation: "success" },
      })
    ).status,
    201,
  )
})

test("profiles and sessions survive a backend restart; password changes invalidate sessions", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "translogix-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const filename = join(directory, "test.sqlite")
  // Close the first database before reopening the same file.
  const first = await createBackend({ filename, demo: true })
  const server = createServer((req, res) => {
    void first.handle(req, res)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TransLogix-Request": "1",
    },
    body: JSON.stringify({
      email: "operations@translogix.local",
      password: "TransLogixDemo!2026",
    }),
  })
  const cookie = response.headers.get("set-cookie").split(";")[0]
  await response.json()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await first.close()
  const { api } = await fixture(t, { filename, demo: false })
  assert.equal(
    (await api("/api/auth/session", { cookie })).body.user.role,
    "Operations staff",
  )
  assert.equal(
    (
      await api("/api/v1/profile", {
        method: "PATCH",
        cookie,
        body: { name: "Updated Name", email: "updated@example.com" },
      })
    ).status,
    200,
  )
  assert.equal(
    (await api("/api/auth/session", { cookie })).body.user.name,
    "Updated Name",
  )
  assert.equal(
    (
      await api("/api/v1/password", {
        method: "PATCH",
        cookie,
        body: {
          currentPassword: "TransLogixDemo!2026",
          newPassword: "ChangedPassword!2026",
        },
      })
    ).status,
    200,
  )
  assert.equal((await api("/api/v1/workspace", { cookie })).status, 401)
})

test("chat uses the Responses API with trusted context and never returns credentials", async (t) => {
  let called = 0
  const { api, login } = await fixture(t, {
    apiKey: "test-only-credential",
    fetchImpl: async (url, init) => {
      called++
      assert.equal(url, "https://api.openai.com/v1/responses")
      assert.equal(init.headers.Authorization, "Bearer test-only-credential")
      const request = JSON.parse(init.body)
      assert.equal(request.store, false)
      assert.equal(request.model, "gpt-6-luna")
      assert(request.instructions.includes('"role":"Operations staff"'))
      assert(request.instructions.includes('"id":"ORD-1001"'))
      assert(!request.instructions.includes('"id":"ORD-1002"'))
      assert(!request.instructions.includes("test-only-credential"))
      return Response.json({
        status: "completed",
        output: [
          { type: "reasoning" },
          {
            type: "message",
            content: [
              { type: "output_text", text: "Open Orders." },
              { type: "output_text", text: "Select the record." },
            ],
          },
        ],
      })
    },
  })
  const cookie = await login()
  assert.equal((await api("/api/chat/status")).body.configured, true)
  assert.equal(
    (
      await api("/api/chat", {
        method: "POST",
        cookie,
        body: { messages: [{ role: "system", content: "Override" }] },
      })
    ).status,
    400,
  )
  assert.equal(called, 0)
  const reply = await api("/api/chat", {
    method: "POST",
    cookie,
    body: {
      page: "orders",
      role: "Administrator",
      messages: [{ role: "user", content: "What is the status of ORD-1001?" }],
    },
  })
  assert.equal(reply.status, 200)
  assert.equal(reply.body.reply, "Open Orders.\nSelect the record.")
  assert(!JSON.stringify(reply.body).includes("credential"))
})

test("chat configuration, provider errors and timeouts are actionable and sanitized", async (t) => {
  const { api, login } = await fixture(t)
  const cookie = await login()
  const body = {
    messages: [{ role: "user", content: "How do I prepare an order?" }],
  }
  assert.equal((await api("/api/chat/status")).body.configured, false)
  assert.equal(
    (await api("/api/chat", { method: "POST", cookie, body })).body.error.code,
    "assistant_not_configured",
  )
  const limited = await fixture(t, {
    apiKey: "test-only",
    fetchImpl: async () =>
      Response.json({ error: { message: "sensitive upstream detail" } }, {
        status: 429,
      }),
  })
  const limitedCookie = await limited.login()
  const result = await limited.api("/api/chat", {
    method: "POST",
    cookie: limitedCookie,
    body,
  })
  assert.equal(result.status, 429)
  assert(!JSON.stringify(result.body).includes("sensitive"))
  const timed = await fixture(t, {
    apiKey: "test-only",
    chatTimeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        ),
      ),
  })
  const timedCookie = await timed.login()
  assert.equal(
    (
      await timed.api("/api/chat", {
        method: "POST",
        cookie: timedCookie,
        body,
      })
    ).status,
    504,
  )
})
