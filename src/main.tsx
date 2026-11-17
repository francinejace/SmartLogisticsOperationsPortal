import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { applyTheme, getPreferredTheme } from "./theme"

applyTheme(getPreferredTheme())

// Use the actual hosting address, including renamed Vercel projects and previews.
const siteUrl = new URL(import.meta.env.BASE_URL, window.location.href).href
document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", siteUrl)
document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", siteUrl)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
