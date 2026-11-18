import { AsyncLocalStorage } from "node:async_hooks"
import { createRequire } from "node:module"
import type { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import pg from "pg"

const require = createRequire(import.meta.url)

export type Row = Record<string, unknown>
type Value = string | number | null

// The same parameterized queries run on local SQLite and managed PostgreSQL.
export default class Storage {
  dialect: "sqlite" | "postgres"
  private sqlite?: DatabaseSync
  private pool?: pg.Pool
  private scope = new AsyncLocalStorage<pg.PoolClient | true>()
  private pending: Promise<void> = Promise.resolve()

  constructor(filename: string, url?: string, pool?: pg.Pool) {
    this.dialect = url || pool ? "postgres" : "sqlite"
    if (this.dialect === "postgres") {
      this.pool =
        pool ||
        new pg.Pool({
          connectionString: url,
          max: 5,
          min: 1,
          idleTimeoutMillis: 5000,
          connectionTimeoutMillis: 10000,
          allowExitOnIdle: true,
        })
      if (process.env.VERCEL) {
        const { attachDatabasePool } = require(
          "@vercel/functions",
        ) as typeof import("@vercel/functions")
        attachDatabasePool(this.pool)
      }
      // A disconnected idle client must not crash a warm function instance.
      this.pool.on("error", () => {})
    } else {
      if (filename !== ":memory:")
        mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
      // Do not load SQLite in a Vercel function. Its PostgreSQL path needs no
      // filesystem database module, while local development still gets SQLite.
      const { DatabaseSync: LocalDatabaseSync } = require(
        "node:sqlite",
      ) as typeof import("node:sqlite")
      this.sqlite = new LocalDatabaseSync(filename)
      this.sqlite.exec(
        "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
      )
    }
  }

  private async exclusive<T,>(operation: () => Promise<T>): Promise<T> {
    const previous = this.pending
    let release = () => {}
    this.pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  private async query(sql: string, values: Value[] = []): Promise<Row[]> {
    if (this.pool) {
      let index = 0
      const text = sql.replace(/\?/g, () => `$${++index}`)
      const client = this.scope.getStore()
      const result = await (
        client && client !== true ? client : this.pool
      ).query(text, values)
      return result.rows
    }
    const execute = async () =>
      this.sqlite!.prepare(sql).all(...values) as Row[]
    return this.scope.getStore() ? execute() : this.exclusive(execute)
  }

  prepare(sql: string) {
    return {
      get: async (...values: Value[]) => (await this.query(sql, values))[0],
      all: (...values: Value[]) => this.query(sql, values),
      run: async (...values: Value[]) => {
        await this.query(sql, values)
      },
    }
  }

  async exec(sql: string) {
    if (this.pool) {
      const client = this.scope.getStore()
      await (client && client !== true ? client : this.pool).query(sql)
    } else {
      const execute = async () => {
        this.sqlite!.exec(sql)
      }
      if (this.scope.getStore()) await execute()
      else await this.exclusive(execute)
    }
  }

  async transaction<T,>(operation: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) return operation()
    if (this.pool) {
      const client = await this.pool.connect()
      try {
        await client.query("BEGIN")
        // Small shared workspace: serialize mutations across function instances.
        // This also protects first-run schema/seed initialization.
        await client.query("SELECT pg_advisory_xact_lock(78503124)")
        const result = await this.scope.run(client, operation)
        await client.query("COMMIT")
        return result
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }
    }
    return this.exclusive(async () => {
      this.sqlite!.exec("BEGIN IMMEDIATE")
      try {
        const result = await this.scope.run(true, operation)
        this.sqlite!.exec("COMMIT")
        return result
      } catch (error) {
        this.sqlite!.exec("ROLLBACK")
        throw error
      }
    })
  }

  async close() {
    if (this.pool) await this.pool.end()
    else
      await this.exclusive(async () => {
        this.sqlite!.close()
      })
  }
}
