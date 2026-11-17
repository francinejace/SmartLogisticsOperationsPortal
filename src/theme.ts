export type Theme = "light" | "dark"

import { LEGACY_BRAND_KEY } from "./brand.ts"

const THEME_STORAGE_KEY = "trancelogix-theme"

export function getPreferredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
    const legacy = window.localStorage.getItem(`${LEGACY_BRAND_KEY}-theme`)
    if (legacy === "light" || legacy === "dark") {
      saveThemePreference(legacy)
      return legacy
    }
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function saveThemePreference(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage restrictions should not prevent an in-session theme change.
  }
}
