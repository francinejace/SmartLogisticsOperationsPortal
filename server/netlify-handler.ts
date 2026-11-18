import { withLambda } from "@netlify/aws-lambda-compat"
import type { HandlerResponse } from "@netlify/aws-lambda-compat"
import type { Context } from "@netlify/functions"
import type { IncomingMessage, ServerResponse } from "node:http"
import serverless from "serverless-http"
import type { createBackend } from "./backend.ts"

type Backend = Awaited<ReturnType<typeof createBackend>>
interface NetlifyHandlerOptions {
  env?: NodeJS.ProcessEnv
  start?: typeof createBackend
}

const jsonError = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })

export default function createNetlifyHandler({
  env = process.env,
  start = async (options) => {
    const { createBackend } = await import("./backend.ts")
    return createBackend(options)
  },
}: NetlifyHandlerOptions = {}) {
  let backend: Promise<Backend> | undefined

  return async (request: Request, context: Context): Promise<Response> => {
    if (!env.DATABASE_URL?.trim())
      return jsonError(
        503,
        "backend_not_configured",
        "The workspace database is not connected. Set DATABASE_URL in the Netlify project's environment variables with Functions access, then redeploy.",
      )
    if (request.signal.aborted)
      return jsonError(499, "request_cancelled", "Response stopped.")

    try {
      backend ||= start({
        // Hosted instances always use shared PostgreSQL, never local demo data.
        filename: ":memory:",
        databaseUrl: env.DATABASE_URL,
        demo: false,
        adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
        adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        secureCookies: true,
      }).catch((error: unknown) => {
        backend = undefined
        throw error
      })
      const instance = await backend
      if (request.signal.aborted)
        return jsonError(499, "request_cancelled", "Response stopped.")

      const invoke = serverless(
        async (req: IncomingMessage, res: ServerResponse) => {
          // Preserve chat cancellation when the browser stops a request.
          const cancel = () => res.emit("close")
          request.signal.addEventListener("abort", cancel, { once: true })
          try {
            // serverless-http exposes the raw bytes as req.body. Let the
            // existing stream parser validate JSON and enforce its size limit.
            const incoming = req as IncomingMessage & { body?: unknown }
            if (Buffer.isBuffer(incoming.body)) delete incoming.body
            await instance.handle(req, res)
          } finally {
            request.signal.removeEventListener("abort", cancel)
          }
        },
      )
      return await withLambda(async (event, lambdaContext) => {
        const url = new URL(request.url)
        // Use the requested site host for the existing same-origin checks.
        event.headers.host = url.host
        event.multiValueHeaders.host = [url.host]
        return (await invoke(
          {
            ...event,
            requestContext: {
              requestId: context.requestId,
              // Netlify's trusted context prevents spoofed client-IP headers
              // from bypassing the database-backed login rate limiter.
              identity: { sourceIp: context.ip || "unknown" },
            },
          },
          lambdaContext,
        )) as HandlerResponse
      })(request, context)
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "initialization_failed"
      // Do not log database URLs, passwords, or raw driver error messages.
      console.error("TranceLogix Netlify API unavailable", {
        code: /^[A-Za-z0-9_]{1,64}$/.test(code) ? code : "unknown_error",
      })
      return jsonError(
        503,
        "backend_unavailable",
        "The workspace API could not start. Check the Netlify function logs and DATABASE_URL. A new database also needs BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.",
      )
    }
  }
}
