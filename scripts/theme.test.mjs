import assert from "node:assert/strict"
import { test } from "node:test"
import {
  applyTheme,
  getPreferredTheme,
  saveThemePreference,
} from "../src/theme.ts"
import { LEGACY_BRAND_KEY } from "../src/brand.ts"

function withBrowser(
  {
    stored = null,
    systemDark = false,
    blockRead = false,
    blockWrite = false,
    legacyStored = null,
  } = {},
  run,
) {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const storage = new Map(stored === null ? [] : [["trancelogix-theme", stored]])
  if (legacyStored !== null) storage.set(`${LEGACY_BRAND_KEY}-theme`, legacyStored)
  globalThis.window = {
    matchMedia: () => ({ matches: systemDark }),
    localStorage: {
      getItem(key) {
        if (blockRead) throw new Error("Storage unavailable")
        return storage.get(key) ?? null
      },
      setItem(key, value) {
        if (blockWrite) throw new Error("Storage unavailable")
        storage.set(key, value)
      },
    },
  }
  globalThis.document = { documentElement: { dataset: {} } }
  try {
    run(storage)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
}

test("uses the system preference when no theme is saved", () => {
  withBrowser({ systemDark: false }, () =>
    assert.equal(getPreferredTheme(), "light"),
  )
  withBrowser({ systemDark: true }, () =>
    assert.equal(getPreferredTheme(), "dark"),
  )
})

test("carries a pre-rename theme preference into the current brand key", () => {
  withBrowser({ legacyStored: "dark" }, storage => {
    assert.equal(getPreferredTheme(), "dark")
    assert.equal(storage.get("trancelogix-theme"), "dark")
  })
  withBrowser({ stored: "light", legacyStored: "dark" }, () => {
    assert.equal(getPreferredTheme(), "light")
  })
})

test("a saved choice takes priority over the system preference", () => {
  withBrowser({ stored: "light", systemDark: true }, () =>
    assert.equal(getPreferredTheme(), "light"),
  )
  withBrowser({ stored: "dark", systemDark: false }, () =>
    assert.equal(getPreferredTheme(), "dark"),
  )
})

test("ignores invalid stored values", () => {
  withBrowser({ stored: "invalid", systemDark: true }, () =>
    assert.equal(getPreferredTheme(), "dark"),
  )
})

test("falls back to the system preference when storage cannot be read", () => {
  withBrowser({ blockRead: true, systemDark: true }, () =>
    assert.equal(getPreferredTheme(), "dark"),
  )
})

test("persists a theme choice under the application key", () => {
  withBrowser({}, (storage) => {
    saveThemePreference("dark")
    assert.equal(storage.get("trancelogix-theme"), "dark")
  })
})

test("a failed storage write does not prevent the theme from changing", () => {
  withBrowser({ blockWrite: true }, () => {
    assert.doesNotThrow(() => saveThemePreference("dark"))
    applyTheme("dark")
    assert.equal(document.documentElement.dataset.theme, "dark")
  })
})

test("applies both themes to the document", () => {
  withBrowser({}, () => {
    applyTheme("dark")
    assert.equal(document.documentElement.dataset.theme, "dark")
    applyTheme("light")
    assert.equal(document.documentElement.dataset.theme, "light")
  })
})
