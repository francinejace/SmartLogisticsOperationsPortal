import type { IncomingMessage, ServerResponse } from "node:http"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import type Storage from "./storage.ts"
import type {
  ActivityRecord,
  OrderRecord,
  ShipmentRecord,
  User,
  WorkspaceSnapshot,
} from "../src/api-types.ts"
import {
  checkPassword,
  hashPassword,
  openDatabase,
  transaction,
} from "./database.ts"
import type { DatabaseOptions } from "./database.ts"
import { answerChat } from "./chat.ts"
interface BackendOptions extends DatabaseOptions {
  apiKey?: string
  model?: string
  secureCookies?: boolean
  fetchImpl?: typeof fetch
  chatTimeoutMs?: number
}
class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = "request_failed") {
    super(message)
    this.status = status
    this.code = code
  }
}
type Row = Record<string, unknown>
const roles = ["Administrator", "Operations staff", "Warehouse staff"]
const carriers = ["LBC Express", "J&T Express", "2GO Express"]
const cookieName = "translogix_session"
const sessionLifetime = 8 * 60 * 60 * 1000
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex")
export async function createBackend(options: BackendOptions) {
  const db = await openDatabase(options)
  let activeChat = 0
  // Use the same work factor for an unknown account and a wrong password.
  const dummyPassword = hashPassword(randomBytes(32).toString("hex"))
  const one = async (sql: string, ...args: (string | number | null)[]) =>
    (await db.prepare(sql).get(...args)) as Row | undefined
  const all = async (sql: string, ...args: (string | number | null)[]) =>
    (await db.prepare(sql).all(...args)) as Row[]
  const userView = (row: Row): User => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as User["role"],
  })
  const orders = async (): Promise<OrderRecord[]> =>
    (
      await all(`SELECT o.*, p.picked, p.packed, p.weight, p.notes, p.shortage, p.updated_at, c.outcome
    FROM orders o JOIN preparations p ON p.order_id = o.id LEFT JOIN carrier_requests c ON c.order_id = o.id ORDER BY o.created_at DESC, o.id DESC`)
    ).map((row) => ({
      id: String(row.id),
      customerId: String(row.customer_id),
      customer: String(row.customer),
      destination: String(row.destination),
      items: JSON.parse(String(row.items)),
      order: "Accepted",
      inventory: String(row.inventory),
      shipment: String(row.shipment),
      date: dateLabel(String(row.created_at)),
      createdAt: String(row.created_at),
      carrierOutcome: row.outcome ? String(row.outcome) : null,
      preparation: {
        picked: Boolean(row.picked),
        packed: Boolean(row.packed),
        weight: row.weight === null ? null : Number(row.weight),
        notes: String(row.notes),
        shortage: Boolean(row.shortage),
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      },
    }))
  const shipments = async (): Promise<ShipmentRecord[]> =>
    (
      await all(
        "SELECT s.*, o.destination FROM shipments s JOIN orders o ON o.id = s.order_id ORDER BY s.created_at DESC, s.id DESC",
      )
    ).map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      carrier: String(row.carrier),
      tracking: String(row.tracking),
      destination: String(row.destination),
      fee: new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(Number(row.fee_cents) / 100),
      status: String(row.status),
      sync: String(row.sync),
      updated: dateLabel(String(row.updated_at)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      idempotencyKey: String(row.idempotency_key),
    }))
  const activity = async (user: User): Promise<ActivityRecord[]> =>
    (await all("SELECT * FROM activity ORDER BY id DESC LIMIT 200")).map(
      (row) => ({
        id: String(row.id),
        title: String(row.title),
        message: String(row.message),
        actor: String(row.actor),
        reference: String(row.reference),
        tone: String(row.tone),
        createdAt: String(row.created_at),
        correlationId: String(row.correlation_id),
        ...(user.role === "Administrator"
          ? { details: JSON.parse(String(row.details)) }
          : {}),
      }),
    )
  const snapshot = async (user: User): Promise<WorkspaceSnapshot> => ({
    user,
    orders: await orders(),
    shipments: await shipments(),
    inventory: (await all(
      "SELECT sku, name, stock FROM inventory ORDER BY sku",
    )) as unknown as WorkspaceSnapshot["inventory"],
    activity: await activity(user),
    users:
      user.role === "Administrator"
        ? (
            await all("SELECT id, name, email, role FROM users ORDER BY name")
          ).map(userView)
        : [],
    simulation: true,
  })
  const record = async (
    user: User,
    title: string,
    reference: string,
    message: string,
    tone = "success",
    details: Row = {},
  ) => {
    await db
      .prepare(
        "INSERT INTO activity (title, message, actor, reference, tone, created_at, correlation_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        title,
        message,
        user.name,
        reference,
        tone,
        new Date().toISOString(),
        `cor_${randomUUID()}`,
        JSON.stringify({ ...details, simulation: true }),
      )
  }
  const requireOrder = async (id: string) => {
    const order = (await orders()).find((row) => row.id === id)
    if (!order) throw new HttpError(404, "Order not found.")
    return order
  }
  const authorize = (user: User, permitted: string[]) => {
    if (!permitted.includes(user.role))
      throw new HttpError(
        403,
        "Your account does not have permission for this action.",
        "forbidden",
      )
  }
  const sessionUser = async (req: IncomingMessage) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
    const row = await one(
      "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
      digest(token),
      Date.now(),
    )
    return row ? userView(row) : null
  }
  const cookie = (token: string, maxAge: number) =>
    `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${
      options.secureCookies ? "; Secure" : ""
    }`
  async function route(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
    url: URL,
  ) {
    const method = req.method || "GET"
    if (!["GET", "POST", "PUT", "PATCH"].includes(method))
      throw new HttpError(405, "Method not allowed.")
    if (req.headers.origin) {
      let origin: URL
      try {
        origin = new URL(req.headers.origin)
      } catch {
        throw new HttpError(403, "Request origin is not allowed.")
      }
      if (
        !["http:", "https:"].includes(origin.protocol) ||
        origin.host !== req.headers.host
      )
        throw new HttpError(403, "Request origin is not allowed.")
    }
    if (method !== "GET" && req.headers["x-translogix-request"] !== "1")
      throw new HttpError(403, "Request verification failed.")
    if (path === "/api/health" && method === "GET")
      return json(res, 200, {
        ok: true,
        database: "connected",
        integrations: "simulation",
      })
    if (path === "/api/chat/status" && method === "GET")
      return json(res, 200, { configured: Boolean(options.apiKey?.trim()) })
    const user = await sessionUser(req)
    if (path === "/api/auth/session" && method === "GET")
      return json(res, 200, { user })
    if (path === "/api/auth/login" && method === "POST") {
      await rateLimit(
        db,
        "login:" +
          digest(
            process.env.VERCEL
              ? String(
                  req.headers["x-vercel-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    "local",
                )
              : req.socket.remoteAddress || "local",
          ),
        10,
        15 * 60 * 1000,
      )
      const body = await readJson(req)
      const email = stringField(body.email, "Email", 254).toLowerCase()
      const password = stringField(body.password, "Password", 200, false)
      const found = await one("SELECT * FROM users WHERE email = ?", email)
      if (
        !checkPassword(
          password,
          found ? String(found.password_hash) : dummyPassword,
        ) ||
        !found
      )
        throw new HttpError(
          401,
          "Email or password is incorrect.",
          "invalid_credentials",
        )
      const token = randomBytes(32).toString("hex")
      await transaction(db, async () => {
        await db
          .prepare("DELETE FROM sessions WHERE expires_at <= ?")
          .run(Date.now())
        await db
          .prepare("INSERT INTO sessions VALUES (?, ?, ?)")
          .run(digest(token), String(found.id), Date.now() + sessionLifetime)
      })
      res.setHeader("Set-Cookie", cookie(token, sessionLifetime / 1000))
      return json(res, 200, { user: userView(found) })
    }
    if (path === "/api/auth/logout" && method === "POST") {
      const token = req.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1)
      if (token)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash = ?")
          .run(digest(token))
      res.setHeader("Set-Cookie", cookie("", 0))
      return json(res, 200, { ok: true })
    }
    if (!user)
      throw new HttpError(
        401,
        "Sign in to continue.",
        "authentication_required",
      )
    if (path === "/api/v1/workspace" && method === "GET")
      return json(res, 200, await snapshot(user))
    if (path === "/api/v1/orders" && method === "GET")
      return json(res, 200, { orders: await orders() })
    if (path === "/api/v1/orders" && method === "POST") {
      authorize(user, ["Administrator", "Operations staff"])
      const body = await readJson(req)
      const id = identifier(body.orderId, "Order ID")
      const customerId = identifier(body.customerId, "Customer ID")
      const destination = stringField(body.destination, "Destination", 200)
      const customer = body.customer
        ? stringField(body.customer, "Customer name", 200)
        : customerId
      if (
        !Array.isArray(body.items) ||
        body.items.length < 1 ||
        body.items.length > 50
      )
        throw new HttpError(400, "Provide between 1 and 50 order items.")
      const seen = new Set<string>()
      const items = await Promise.all(
        body.items.map(async (value) => {
          if (!isObject(value)) throw new HttpError(400, "Invalid order item.")
          const sku = identifier(value.sku, "SKU")
          if (seen.has(sku))
            throw new HttpError(400, "Combine duplicate SKUs into one item.")
          seen.add(sku)
          if (
            typeof value.quantity !== "number" ||
            !Number.isSafeInteger(value.quantity) ||
            value.quantity <= 0 ||
            value.quantity > 1000000
          )
            throw new HttpError(
              400,
              "Each quantity must be a positive whole number, up to 1,000,000.",
            )
          const product = await one(
            "SELECT name FROM inventory WHERE sku = ?",
            sku,
          )
          if (!product)
            throw new HttpError(
              400,
              `Unknown SKU: ${sku}. Choose a warehouse product.`,
            )
          return { sku, qty: value.quantity, name: String(product.name) }
        }),
      )
      await transaction(db, async () => {
        if (await one("SELECT id FROM orders WHERE id = ?", id))
          throw new HttpError(
            409,
            "Order ID already exists. Your entries have been preserved.",
            "duplicate_order",
          )
        await db
          .prepare(
            "INSERT INTO orders (id, customer_id, customer, destination, items, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            customerId,
            customer,
            destination,
            JSON.stringify(items),
            new Date().toISOString(),
          )
        await db
          .prepare("INSERT INTO preparations (order_id) VALUES (?)")
          .run(id)
        await record(
          user,
          "Order accepted",
          id,
          "Order validated and saved. Inventory has not been checked.",
        )
      })
      return json(res, 201, { order: await requireOrder(id) })
    }
    const detailMatch = path.match(/^\/api\/v1\/orders\/([^/]+)$/)
    if (detailMatch && method === "GET")
      return json(res, 200, {
        order: await requireOrder(decodeURIComponent(detailMatch[1])),
      })
    if (path === "/api/v1/inventory/check" && method === "POST") {
      const body = await readJson(req)
      const order = await requireOrder(identifier(body.orderId, "Order ID"))
      const stocks = await all("SELECT sku, stock FROM inventory")
      const available = order.items.every(
        (item) =>
          Number(
            stocks.find((product) => product.sku === item.sku)?.stock || 0,
          ) >= item.qty,
      )
      await transaction(db, async () => {
        await db
          .prepare(
            "UPDATE orders SET inventory = ?, shipment = CASE WHEN shipment IN ('Not started','Blocked') THEN ? ELSE shipment END WHERE id = ?",
          )
          .run(
            available ? "Available" : "Unavailable",
            available ? "Not started" : "Blocked",
            order.id,
          )
        await record(
          user,
          available ? "Inventory confirmed" : "Inventory unavailable",
          order.id,
          "Simulated WMS availability check. Stock has not been reserved or deducted.",
          available ? "success" : "danger",
        )
      })
      return json(res, 200, {
        available,
        simulation: true,
        order: await requireOrder(order.id),
      })
    }
    const preparationMatch = path.match(
      /^\/api\/v1\/orders\/([^/]+)\/preparation$/,
    )
    if (preparationMatch && method === "PUT") {
      const order = await requireOrder(decodeURIComponent(preparationMatch[1]))
      if (await one("SELECT id FROM shipments WHERE order_id = ?", order.id))
        throw new HttpError(
          409,
          "This order already has a shipment. Its preparation record is locked.",
        )
      const body = await readJson(req)
      if (
        [body.picked, body.packed, body.shortage].some(
          (v) => typeof v !== "boolean",
        )
      )
        throw new HttpError(
          400,
          "Picking, packing, and shortage must be true or false.",
        )
      if (
        body.weight !== null &&
        (typeof body.weight !== "number" ||
          !Number.isFinite(body.weight) ||
          body.weight <= 0 ||
          body.weight > 10000)
      )
        throw new HttpError(
          400,
          "Weight must be empty or a positive number up to 10,000 kg.",
        )
      const notes =
        body.notes === undefined
          ? ""
          : stringField(body.notes, "Notes", 1000, false)
      await transaction(db, async () => {
        if (await one("SELECT id FROM shipments WHERE order_id = ?", order.id))
          throw new HttpError(
            409,
            "This order already has a shipment. Its preparation record is locked.",
          )
        await db
          .prepare(
            "UPDATE preparations SET picked = ?, packed = ?, shortage = ?, weight = ?, notes = ?, updated_at = ? WHERE order_id = ?",
          )
          .run(
            Number(body.picked),
            Number(body.packed),
            Number(body.shortage),
            body.weight as number | null,
            notes,
            new Date().toISOString(),
            order.id,
          )
        await record(
          user,
          "Preparation saved",
          order.id,
          body.shortage
            ? "Shortage flagged. Shipment creation is blocked."
            : "Picking, packing, weight, and notes saved.",
          body.shortage ? "warning" : "success",
        )
      })
      return json(res, 200, { order: await requireOrder(order.id) })
    }
    if (path === "/api/v1/shipments" && method === "GET")
      return json(res, 200, { shipments: await shipments() })
    if (path === "/api/v1/shipments" && method === "POST") {
      authorize(user, ["Administrator", "Operations staff"])
      const body = await readJson(req)
      const orderId = identifier(body.orderId, "Order ID")
      const result = await transaction(db, async () => {
        const order = await requireOrder(orderId)
        const existing = (await shipments()).find(
          (row) => row.orderId === order.id,
        )
        if (existing)
          return {
            status: 200,
            body: { shipment: existing, replay: true, simulation: true },
          }
        if (order.carrierOutcome === "unknown")
          throw new HttpError(
            409,
            "Carrier outcome is unknown. Check carrier status before retrying.",
            "outcome_unknown",
          )
        const prep = order.preparation
        if (
          order.inventory !== "Available" ||
          !prep.picked ||
          !prep.packed ||
          prep.shortage ||
          !prep.weight ||
          !Number.isFinite(prep.weight)
        )
          throw new HttpError(
            409,
            "Confirm inventory and save completed preparation with a positive weight before creating a shipment.",
            "prerequisites_incomplete",
          )
        const carrier = stringField(body.carrier, "Carrier", 50)
        if (!carriers.includes(carrier))
          throw new HttpError(400, "Choose a supported carrier.")
        const outcome = body.simulation || "success"
        if (
          !["success", "timeout", "unavailable", "sync_failure"].includes(
            String(outcome),
          )
        )
          throw new HttpError(400, "Invalid simulation outcome.")
        const key = `shipment:${order.id}`
        if (outcome === "timeout" || outcome === "unavailable") {
          await db
            .prepare(
              "INSERT INTO carrier_requests VALUES (?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET outcome = excluded.outcome",
            )
            .run(
              order.id,
              key,
              outcome === "timeout" ? "unknown" : "not_created",
            )
          await db
            .prepare("UPDATE orders SET shipment = ? WHERE id = ?")
            .run(
              outcome === "timeout"
                ? "Confirmation required"
                : "Awaiting carrier",
              order.id,
            )
          await record(
            user,
            outcome === "timeout"
              ? "Carrier outcome unknown"
              : "Carrier unavailable",
            order.id,
            outcome === "timeout"
              ? "Simulated timeout. Check carrier status using the retained idempotency reference."
              : "Simulated carrier unavailability. No shipment was created.",
            "warning",
            { idempotencyKey: key },
          )
          return {
            status: outcome === "timeout" ? 409 : 503,
            body: {
              error: {
                code:
                  outcome === "timeout"
                    ? "outcome_unknown"
                    : "carrier_unavailable",
                message:
                  outcome === "timeout"
                    ? "Simulated timeout. Check carrier status before retrying."
                    : "Simulated carrier unavailable. Order and preparation are retained.",
              },
            },
          }
        }
        const id = `SHP-${randomUUID().slice(0, 8).toUpperCase()}`
        const tracking = `TRK-${randomBytes(6).toString("hex").toUpperCase()}`
        const now = new Date().toISOString()
        await db
          .prepare(
            "INSERT INTO carrier_requests VALUES (?, ?, 'confirmed') ON CONFLICT(order_id) DO UPDATE SET outcome = 'confirmed'",
          )
          .run(order.id, key)
        await db
          .prepare(
            "INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            order.id,
            carrier,
            tracking,
            Math.round(15000 + prep.weight * 8000),
            "Label created",
            outcome === "sync_failure" ? "Pending" : "Synchronized",
            key,
            now,
            now,
          )
        await db
          .prepare("UPDATE orders SET shipment = 'Created' WHERE id = ?")
          .run(order.id)
        await record(
          user,
          "Shipment confirmed",
          id,
          "Simulated carrier confirmation saved. Confirmation does not mean dispatch.",
          "success",
          { orderId: order.id, idempotencyKey: key },
        )
        if (outcome === "sync_failure")
          await record(
            user,
            "OMS synchronization pending",
            id,
            "Simulated OMS failure. Shipment retained; retry synchronization only.",
            "warning",
          )
        return {
          status: 201,
          body: {
            shipment: (await shipments()).find((row) => row.id === id),
            simulation: true,
          },
        }
      })
      return json(res, result.status, result.body)
    }
    if (path === "/api/v1/carrier/check" && method === "POST") {
      authorize(user, ["Administrator", "Operations staff"])
      const body = await readJson(req)
      const order = await requireOrder(identifier(body.orderId, "Order ID"))
      const existing = (await shipments()).find(
        (row) => row.orderId === order.id,
      )
      await transaction(db, async () => {
        await db
          .prepare("UPDATE carrier_requests SET outcome = ? WHERE order_id = ?")
          .run(existing ? "confirmed" : "not_created", order.id)
        if (!existing)
          await db
            .prepare("UPDATE orders SET shipment = 'Not started' WHERE id = ?")
            .run(order.id)
        await record(
          user,
          "Carrier status checked",
          order.id,
          existing
            ? "Existing simulated shipment confirmed. Do not create another shipment."
            : "Simulation confirmed no shipment exists. The same idempotency reference may now be retried.",
        )
      })
      return json(res, 200, {
        outcome: existing ? "confirmed" : "not_created",
        shipment: existing || null,
        simulation: true,
      })
    }
    const syncMatch = path.match(/^\/api\/v1\/shipments\/([^/]+)\/sync$/)
    if (syncMatch && method === "POST") {
      authorize(user, ["Administrator", "Operations staff"])
      const id = decodeURIComponent(syncMatch[1])
      if (!(await one("SELECT id FROM shipments WHERE id = ?", id)))
        throw new HttpError(404, "Shipment not found.")
      await transaction(db, async () => {
        await db
          .prepare(
            "UPDATE shipments SET sync = 'Synchronized', updated_at = ? WHERE id = ?",
          )
          .run(new Date().toISOString(), id)
        await record(
          user,
          "OMS synchronization completed",
          id,
          "Simulated synchronization completed using the existing shipment.",
        )
      })
      return json(res, 200, {
        shipment: (await shipments()).find((row) => row.id === id),
        simulation: true,
      })
    }
    if (path === "/api/v1/tracking" && method === "GET") {
      const reference = (url.searchParams.get("reference") || "")
        .trim()
        .toUpperCase()
      const shipment = (await shipments()).find((row) =>
        [row.id, row.orderId, row.tracking].includes(reference),
      )
      if (!shipment)
        throw new HttpError(404, "No matching tracking record.", "not_found")
      return json(res, 200, {
        shipment,
        activity: (await activity(user)).filter((event) =>
          [shipment.id, shipment.orderId, shipment.tracking].includes(
            event.reference,
          ),
        ),
        simulation: true,
      })
    }
    if (path === "/api/v1/profile" && method === "PATCH") {
      const body = await readJson(req)
      const name = stringField(body.name, "Display name", 100)
      const email = validEmail(body.email)
      if (
        await one(
          "SELECT id FROM users WHERE email = ? AND id != ?",
          email,
          user.id,
        )
      )
        throw new HttpError(409, "That email is already registered.")
      await transaction(db, async () => {
        await db
          .prepare("UPDATE users SET name = ?, email = ? WHERE id = ?")
          .run(name, email, user.id)
        await record(
          { ...user, name },
          "Profile updated",
          user.id,
          "Display name and email updated.",
        )
      })
      return json(res, 200, {
        user: userView(
          (await one("SELECT * FROM users WHERE id = ?", user.id))!,
        ),
      })
    }
    if (path === "/api/v1/password" && method === "PATCH") {
      const body = await readJson(req)
      const current = stringField(
        body.currentPassword,
        "Current password",
        200,
        false,
      )
      const password = stringField(body.newPassword, "New password", 200, false)
      if (password.length < 12)
        throw new HttpError(
          400,
          "Use at least 12 characters for your new password.",
        )
      if (
        !checkPassword(
          current,
          String(
            (await one(
              "SELECT password_hash FROM users WHERE id = ?",
              user.id,
            ))!.password_hash,
          ),
        )
      )
        throw new HttpError(400, "Current password is incorrect.")
      await transaction(db, async () => {
        await db
          .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
          .run(hashPassword(password), user.id)
        await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id)
        await record(
          user,
          "Password changed",
          user.id,
          "All sessions signed out after password change.",
        )
      })
      res.setHeader("Set-Cookie", cookie("", 0))
      return json(res, 200, { ok: true, signInRequired: true })
    }
    if (path === "/api/v1/users" && method === "POST") {
      authorize(user, ["Administrator"])
      const body = await readJson(req)
      const name = stringField(body.name, "Name", 100)
      const email = validEmail(body.email)
      const password = stringField(body.password, "Password", 200, false)
      const role = stringField(body.role, "Role", 50)
      if (password.length < 12 || !roles.includes(role))
        throw new HttpError(
          400,
          "Choose a valid role and a password of at least 12 characters.",
        )
      if (await one("SELECT id FROM users WHERE email = ?", email))
        throw new HttpError(409, "That email is already registered.")
      const id = `usr-${randomUUID()}`
      await transaction(db, async () => {
        await db
          .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
          .run(id, name, email, hashPassword(password), role)
        await record(
          user,
          "User created",
          id,
          `Account created with role: ${role}.`,
        )
      })
      return json(res, 201, {
        user: userView((await one("SELECT * FROM users WHERE id = ?", id))!),
      })
    }
    const roleMatch = path.match(/^\/api\/v1\/users\/([^/]+)\/role$/)
    if (roleMatch && method === "PATCH") {
      authorize(user, ["Administrator"])
      const id = decodeURIComponent(roleMatch[1])
      const body = await readJson(req)
      const role = stringField(body.role, "Role", 50)
      if (!roles.includes(role))
        throw new HttpError(400, "Choose a valid role.")
      if (id === user.id)
        throw new HttpError(
          409,
          "Ask another administrator to change your role.",
        )
      if (!(await one("SELECT id FROM users WHERE id = ?", id)))
        throw new HttpError(404, "User not found.")
      await transaction(db, async () => {
        const target = await one("SELECT role FROM users WHERE id = ?", id)
        const administrators = await one(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'Administrator'",
        )
        if (
          target?.role === "Administrator" &&
          role !== "Administrator" &&
          Number(administrators?.count) <= 1
        )
          throw new HttpError(
            409,
            "The workspace must retain an administrator.",
          )
        await db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id)
        await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id)
        await record(
          user,
          "User role updated",
          id,
          `New role: ${role}. Previous sessions revoked.`,
        )
      })
      return json(res, 200, { ok: true })
    }
    if (path === "/api/chat" && method === "POST") {
      await rateLimit(db, "chat:" + user.id, 12, 60 * 1000)
      if (activeChat >= 4)
        throw new HttpError(
          429,
          "The assistant is busy. Please try again shortly.",
          "rate_limited",
        )
      const body = await readJson(req)
      activeChat++
      const controller = new AbortController()
      const cancel = () => {
        if (!res.writableEnded) controller.abort()
      }
      res.on("close", cancel)
      try {
        const result = await answerChat(body, {
          apiKey: options.apiKey,
          model: options.model,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.chatTimeoutMs,
          user,
          snapshot: await snapshot(user),
          signal: controller.signal,
        })
        return json(res, 200, result)
      } finally {
        activeChat--
        res.removeListener("close", cancel)
      }
    }
    throw new HttpError(404, "API endpoint not found.")
  }
  return {
    async handle(
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void = () => {
        json(res, 404, { error: { message: "Not found." } })
      },
    ) {
      const url = new URL(req.url || "/", "http://translogix.local")
      // Handles both a root URL and a Figma preview URL with a base prefix.
      const index = url.pathname.indexOf("/api/")
      if (index < 0) return next()
      try {
        await route(req, res, url.pathname.slice(index), url)
      } catch (error) {
        const known = error instanceof Error && "status" in error
        const conflict =
          error instanceof Error &&
          "code" in error &&
          [
            "23505",
            "SQLITE_CONSTRAINT_UNIQUE",
            "SQLITE_CONSTRAINT_PRIMARYKEY",
          ].includes(String(error.code))
        const status = known ? Number(error.status) : conflict ? 409 : 500
        const message = known
          ? error.message
          : conflict
            ? "A record with that identifier already exists."
            : "Something went wrong. Please try again."
        const code =
          known && "code" in error ? String(error.code) : "server_error"
        if (status === 429) res.setHeader("Retry-After", "60")
        if (!res.destroyed && !res.writableEnded)
          json(res, status, { error: { message, code } })
      }
    },
    async close() {
      await db.close()
    },
  }
}
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(JSON.stringify(body))
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
async function readJson(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  if (
    req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(415, "Send JSON content.")
  const parsed = (req as IncomingMessage & { body?: unknown }).body
  if (parsed !== undefined) {
    if (!isObject(parsed))
      throw new HttpError(400, "Request must be a JSON object.")
    if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > 65536)
      throw new HttpError(413, "Request is too large.")
    return parsed
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > 65536) throw new HttpError(413, "Request is too large.")
    chunks.push(bytes)
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!isObject(body)) throw new Error()
    return body
  } catch {
    throw new HttpError(400, "Request must be a JSON object.")
  }
}
function stringField(value: unknown, name: string, max: number, trim = true) {
  if (typeof value !== "string")
    throw new HttpError(400, `${name} is required.`)
  const result = trim ? value.trim() : value
  if ((trim && !result) || result.length > max || result.includes("\0"))
    throw new HttpError(
      400,
      `${name} must contain ${trim ? "1" : "0"}–${max} characters.`,
    )
  return result
}
function identifier(value: unknown, name: string) {
  const result = stringField(value, name, 64).toUpperCase()
  if (!/^[A-Z0-9_-]+$/.test(result))
    throw new HttpError(
      400,
      `${name} may contain letters, numbers, underscores, and hyphens.`,
    )
  return result
}
function validEmail(value: unknown) {
  const email = stringField(value, "Email", 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Enter a valid email address.")
  return email
}
async function rateLimit(
  db: Storage,
  key: string,
  max: number,
  windowMs: number,
) {
  const allowed = await db.transaction(async () => {
    const now = Date.now()
    await db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now)
    const row = await db
      .prepare("SELECT hits, expires_at FROM rate_limits WHERE key = ?")
      .get(key)
    if (row && Number(row.hits) >= max) return false
    if (row)
      await db
        .prepare("UPDATE rate_limits SET hits = hits + 1 WHERE key = ?")
        .run(key)
    else
      await db
        .prepare("INSERT INTO rate_limits VALUES (?, 1, ?)")
        .run(key, now + windowMs)
    return true
  })
  if (!allowed)
    throw new HttpError(
      429,
      "Too many requests. Please wait before trying again.",
      "rate_limited",
    )
}
