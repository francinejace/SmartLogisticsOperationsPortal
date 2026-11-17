import { createServer } from "node:http"
import { createReadStream, existsSync, statSync } from "node:fs"
import { resolve, sep, extname } from "node:path"
import { createBackend } from "./backend.ts"

// Node reads the private environment file; static assets are served from dist only.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const root = resolve("dist")
if (!existsSync(resolve(root, "index.html"))) throw new Error("Build the frontend with pnpm build before pnpm start.")
const backend = createBackend({
  filename: resolve(process.env.DATABASE_PATH || ".data/translogix.sqlite"),
  demo: process.env.SEED_DEMO_DATA === "true",
  demoPassword: process.env.DEMO_PASSWORD,
  adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
  adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  secureCookies: process.env.COOKIE_SECURE === "true",
})
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" }
const server = createServer((req, res) => {
  void backend.handle(req, res, () => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return }
    let pathname: string
    try { pathname = decodeURIComponent(new URL(req.url || "/", "http://local").pathname) } catch { res.writeHead(400); res.end(); return }
    let file = resolve(root, `.${pathname}`)
    if ((file !== root && !file.startsWith(root + sep)) || pathname.split("/").some(part => part.startsWith("."))) { res.writeHead(404); res.end(); return }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(pathname)) { res.writeHead(404); res.end(); return }
      file = resolve(root, "index.html")
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache" })
    if (req.method === "HEAD") { res.end(); return }
    const stream = createReadStream(file)
    stream.on("error", () => res.destroy())
    stream.pipe(res)
  })
})
server.requestTimeout = 40000
server.listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1", () => {
  console.log(`TransLogix full-stack server listening on http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3000}`)
})
function shutdown() { server.close(() => { backend.close(); process.exit(0) }); server.closeIdleConnections() }
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
