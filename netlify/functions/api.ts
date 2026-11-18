import type { Config } from "@netlify/functions"
import createNetlifyHandler from "../../server/netlify-handler.ts"

export default createNetlifyHandler()

export const config: Config = {
  path: ["/api", "/api/*"],
}
