import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`
}

export function checkPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":")
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(digest, "hex")
  return expected.length === actual.length && timingSafeEqual(actual, expected)
}

export interface DatabaseOptions {
  filename: string
  demo: boolean
  demoPassword?: string
  adminEmail?: string
  adminPassword?: string
}

export function openDatabase(options: DatabaseOptions) {
  if (options.filename !== ":memory:") mkdirSync(dirname(options.filename), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(options.filename)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Administrator','Operations staff','Warehouse staff'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      sku TEXT PRIMARY KEY, name TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, customer TEXT NOT NULL, destination TEXT NOT NULL,
      items TEXT NOT NULL, inventory TEXT NOT NULL DEFAULT 'Not checked', shipment TEXT NOT NULL DEFAULT 'Not started', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preparations (
      order_id TEXT PRIMARY KEY REFERENCES orders(id), picked INTEGER NOT NULL DEFAULT 0,
      packed INTEGER NOT NULL DEFAULT 0, weight REAL, notes TEXT NOT NULL DEFAULT '', shortage INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS carrier_requests (
      order_id TEXT PRIMARY KEY REFERENCES orders(id), idempotency_key TEXT NOT NULL UNIQUE,
      outcome TEXT NOT NULL CHECK(outcome IN ('unknown','not_created','confirmed'))
    );
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), carrier TEXT NOT NULL,
      tracking TEXT NOT NULL UNIQUE, fee_cents INTEGER NOT NULL, status TEXT NOT NULL, sync TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, message TEXT NOT NULL,
      actor TEXT NOT NULL, reference TEXT NOT NULL, tone TEXT NOT NULL, created_at TEXT NOT NULL,
      correlation_id TEXT NOT NULL UNIQUE, details TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  try {
    if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
      if (options.demo) {
        const password = options.demoPassword || "TransLogixDemo!2026"
        const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
        for (const [id, name, email, role] of [
          ["usr-admin", "Maria Santos", "admin@translogix.local", "Administrator"],
          ["usr-operations", "Ana Reyes", "operations@translogix.local", "Operations staff"],
          ["usr-warehouse", "Juan Dela Cruz", "warehouse@translogix.local", "Warehouse staff"],
        ]) insert.run(id, name, email, hashPassword(password), role)
      } else {
        if (!options.adminEmail || !options.adminPassword || options.adminPassword.length < 12) {
          throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) before starting an empty production database.")
        }
        db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run("usr-admin", "Administrator", options.adminEmail.toLowerCase(), hashPassword(options.adminPassword), "Administrator")
      }
    }
    if (!db.prepare("SELECT value FROM metadata WHERE key = 'seeded'").get()) {
      transaction(db, () => {
        for (const row of [
          ["BOX-001", "Heavy-duty storage box", 120],
          ["TAPE-004", "Packaging tape", 35],
          ["WRAP-010", "Protective bubble wrap", 0],
          ["LABEL-002", "Thermal shipping labels", 400],
          ["POUCH-006", "Waterproof mailer pouch", 80],
        ]) db.prepare("INSERT INTO inventory VALUES (?, ?, ?)").run(...row)
        if (options.demo) seedDemo(db)
        db.prepare("INSERT INTO metadata VALUES ('seeded', '1')").run()
        db.prepare("INSERT INTO metadata VALUES ('simulation', 'true')").run()
      })
    }
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = operation()
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function seedDemo(db: DatabaseSync) {
  const rows = [
    ["ORD-1001", "CUS-001", "Luzon Home Supplies", "Tarlac", "BOX-001", 2, "Available", "Created"],
    ["ORD-1002", "CUS-014", "Metro Retail Co.", "Makati", "TAPE-004", 12, "Not checked", "Not started"],
    ["ORD-1003", "CUS-008", "Northstar Merchandising", "Baguio", "WRAP-010", 20, "Unavailable", "Blocked"],
    ["ORD-1004", "CUS-020", "Cebu Trade Depot", "Cebu City", "BOX-001", 5, "WMS unavailable", "Not started"],
    ["ORD-1005", "CUS-031", "Southern Office Hub", "Davao City", "LABEL-002", 8, "Available", "Awaiting carrier"],
    ["ORD-1006", "CUS-026", "Palawan General Store", "Puerto Princesa", "POUCH-006", 6, "Available", "Confirmation required"],
    ["ORD-0998", "CUS-002", "Quezon Retail", "Quezon City", "BOX-001", 1, "Available", "Created"],
    ["ORD-0995", "CUS-003", "Batangas Supplies", "Batangas", "BOX-001", 3, "Available", "Created"],
    ["ORD-0992", "CUS-004", "Iloilo Trade", "Iloilo City", "BOX-001", 4, "Available", "Created"],
  ] as const
  rows.forEach(([id, customerId, customer, destination, sku, qty, inventory, shipment], index) => {
    const product = db.prepare("SELECT name FROM inventory WHERE sku = ?").get(sku)!
    const date = `2025-06-${index < 4 ? "18" : "17"}T0${Math.max(0, 5 - Math.floor(index / 2))}:42:00.000Z`
    db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, customerId, customer, destination, JSON.stringify([{ sku, name: product.name, qty }]), inventory, shipment, date)
    const ready = inventory === "Available"
    db.prepare("INSERT INTO preparations (order_id, picked, packed, weight, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, Number(ready), Number(ready), ready ? 2.5 : null, date)
  })
  for (const [id, orderId, carrier, tracking, fee, status, sync] of [
    ["SHP-5012", "ORD-1001", "LBC Express", "TRK-123456", 35000, "In transit", "Synchronized"],
    ["SHP-5011", "ORD-0998", "J&T Express", "JTX-8094421", 28500, "Delivered", "Synchronized"],
    ["SHP-5009", "ORD-0995", "LBC Express", "TRK-119028", 41000, "Label created", "Pending"],
    ["SHP-5007", "ORD-0992", "2GO Express", "2GO-771203", 52000, "Delivery exception", "Synchronized"],
  ] as const) {
    const date = "2025-06-18T03:26:00.000Z"
    db.prepare("INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, orderId, carrier, tracking, fee, status, sync, `shipment:${orderId}`, date, date)
    db.prepare("INSERT INTO carrier_requests VALUES (?, ?, 'confirmed')").run(orderId, `shipment:${orderId}`)
  }
  db.prepare("INSERT INTO carrier_requests VALUES ('ORD-1006', 'shipment:ORD-1006', 'unknown')").run()
  for (const [title, reference, tone, message] of [
    ["Order accepted", "ORD-1001", "success", "Seeded demonstration order."],
    ["Inventory unavailable", "ORD-1003", "danger", "Simulated WMS confirmed insufficient stock. Shipment blocked."],
    ["WMS unavailable", "ORD-1004", "warning", "Seeded service failure; recheck inventory before preparation."],
    ["Carrier outcome unknown", "ORD-1006", "warning", "Simulated timeout. Check the idempotency reference before retrying."],
    ["OMS synchronization pending", "SHP-5009", "warning", "Shipment retained. Retry synchronization without creating another shipment."],
  ]) db.prepare("INSERT INTO activity (title, message, actor, reference, tone, created_at, correlation_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(title, message, "Demo seed", reference, tone, "2025-06-18T03:30:00.000Z", `seed_${reference}`, JSON.stringify({ simulation: true }))
}
