import type { IncomingMessage, ServerResponse } from "node:http"
import { createBackend } from "../server/backend.ts"

let backend: ReturnType<typeof createBackend> | undefined

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!process.env.DATABASE_URL) {
    res.writeHead(503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    res.end(
      JSON.stringify({
        error: {
          code: "backend_not_configured",
          message:
            "The workspace database is not connected yet. Please contact the project administrator.",
        },
      }),
    )
    return
  }
  try {
    backend ||= createBackend({
      // This path is unused for PostgreSQL. There is no filesystem database fallback on Vercel.
      filename: ":memory:",
      databaseUrl: process.env.DATABASE_URL,
      demo: false,
      adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
      adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      secureCookies: true,
    })
    await (await backend).handle(req, res)
  } catch {
    backend = undefined
    if (!res.headersSent) {
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      res.end(
        JSON.stringify({
          error: {
            code: "backend_unavailable",
            message:
              "The workspace server is temporarily unavailable. Please try again shortly.",
          },
        }),
      )
    }
  }
}
