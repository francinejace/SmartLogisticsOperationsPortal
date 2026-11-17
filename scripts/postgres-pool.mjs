import { PGlite } from "@electric-sql/pglite"

// Real PostgreSQL semantics for local tests, without a hosted account or credentials.
// The production driver is pg; this pool-shaped adapter only replaces its network transport.
export async function createTestPool() {
  const database = new PGlite()
  let pending = Promise.resolve()
  async function acquire() {
    const previous = pending
    let release
    pending = new Promise((resolve) => {
      release = resolve
    })
    await previous
    return release
  }
  const query = async (text, values = []) => {
    if (!values.length && text.includes(";")) {
      const results = await database.exec(text)
      return { rows: results.at(-1)?.rows || [] }
    }
    return database.query(text, values)
  }
  return {
    on() {},
    async connect() {
      const release = await acquire()
      return { query, release }
    },
    async query(text, values) {
      const release = await acquire()
      try {
        return await query(text, values)
      } finally {
        release()
      }
    },
    async end() {
      await pending
      await database.close()
    },
  }
}
