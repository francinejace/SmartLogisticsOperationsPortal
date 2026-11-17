import { loadEnv, type Plugin } from "vite"
import { resolve } from "node:path"
import { createBackend } from "./backend.ts"

export default function translogixBackend(): Plugin {
  let backend: Awaited<ReturnType<typeof createBackend>> | undefined
  return {
    name: "translogix-backend",
    async configureServer(server) {
      backend = await start(
        server.config.mode,
        server.config.envDir,
        server.config.root,
      )
      server.middlewares.use((req, res, next) => {
        void backend!.handle(req, res, next)
      })
      server.httpServer?.once("close", () => backend?.close())
    },
    async configurePreviewServer(server) {
      backend = await start(
        server.config.mode,
        server.config.envDir,
        server.config.root,
      )
      server.middlewares.use((req, res, next) => {
        void backend!.handle(req, res, next)
      })
      server.httpServer.once("close", () => backend?.close())
    },
  }
}

function start(mode: string, envDir: string | false, root: string) {
  // Only the backend reads these values. None use Vite's public VITE_ prefix.
  const env = {
    ...(envDir === false ? {} : loadEnv(mode, envDir, "")),
    ...process.env,
  }
  return createBackend({
    filename: resolve(root, env.DATABASE_PATH || ".data/translogix.sqlite"),
    databaseUrl: env.DATABASE_URL,
    demo: env.SEED_DEMO_DATA !== "false" && env.NODE_ENV !== "production",
    demoPassword: env.DEMO_PASSWORD,
    adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
    adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    secureCookies: env.COOKIE_SECURE === "true",
  })
}
