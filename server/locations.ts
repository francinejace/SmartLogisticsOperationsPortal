import type {
  CityLocation,
  LocationSearchResult,
} from "../src/location-types.ts"

class LocationError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface LocationOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  now?: () => number
}

interface CacheEntry {
  locations: CityLocation[]
  expires: number
}

export default function createLocationSearch({
  fetchImpl = fetch,
  timeoutMs = 7000,
  now = Date.now,
}: LocationOptions = {}) {
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<string, Promise<CityLocation[]>>()
  async function lookup(query: string): Promise<CityLocation[]> {
    // Fixed upstream host: destination text can never become a request URL.
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.searchParams.set("name", query)
    url.searchParams.set("count", "8")
    url.searchParams.set("language", "en")
    const timeout = AbortSignal.timeout(timeoutMs)
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: timeout,
      })
      if (!response.ok)
        throw new LocationError(
          response.status === 429 ? 503 : 502,
          "City lookup is temporarily unavailable. Try again shortly.",
          "location_provider_unavailable",
        )
      const body: unknown = await response.json()
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Invalid provider response")
      const rows = (body as { results?: unknown }).results
      if (rows === undefined) return []
      if (!Array.isArray(rows)) throw new Error("Invalid provider response")
      const locations: CityLocation[] = []
      for (const value of rows) {
        if (!value || typeof value !== "object" || Array.isArray(value))
          continue
        const row = value as Record<string, unknown>
        if (
          typeof row.id !== "number" ||
          !Number.isSafeInteger(row.id) ||
          typeof row.name !== "string" ||
          !row.name.trim() ||
          typeof row.latitude !== "number" ||
          !Number.isFinite(row.latitude) ||
          Math.abs(row.latitude) > 90 ||
          typeof row.longitude !== "number" ||
          !Number.isFinite(row.longitude) ||
          Math.abs(row.longitude) > 180 ||
          typeof row.feature_code !== "string" ||
          !row.feature_code.startsWith("PPL") ||
          locations.some((location) => location.id === row.id)
        )
          continue
        locations.push({
          id: row.id,
          name: row.name.slice(0, 120),
          region:
            typeof row.admin1 === "string" ? row.admin1.slice(0, 120) : "",
          country:
            typeof row.country === "string" ? row.country.slice(0, 100) : "",
          countryCode:
            typeof row.country_code === "string"
              ? row.country_code.slice(0, 2)
              : "",
          latitude: row.latitude,
          longitude: row.longitude,
        })
      }
      // Prefer the workspace's home country while retaining selectable alternatives.
      return locations
        .sort(
          (a, b) =>
            Number(b.countryCode === "PH") - Number(a.countryCode === "PH"),
        )
        .slice(0, 5)
    } catch (cause) {
      if (cause instanceof LocationError) throw cause
      throw new LocationError(
        timeout.aborted ? 504 : 502,
        timeout.aborted
          ? "City lookup took too long. Try again."
          : "The map service could not be reached. Try again.",
        timeout.aborted ? "location_timeout" : "location_connection_error",
      )
    }
  }
  return async (value: unknown): Promise<LocationSearchResult> => {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value))
      throw new LocationError(
        400,
        "Enter a city or municipality.",
        "invalid_location",
      )
    const query = value.trim().replace(/\s+/g, " ")
    if (query.length < 2 || query.length > 120)
      throw new LocationError(
        400,
        "Use a city name between 2 and 120 characters.",
        "invalid_location",
      )
    const key = query.normalize("NFKC").toLowerCase()
    const saved = cache.get(key)
    if (saved && saved.expires > now())
      return { query, locations: saved.locations }
    let request = pending.get(key)
    if (!request) {
      request = lookup(query)
        .then((locations) => {
          if (cache.size >= 256) cache.delete(cache.keys().next().value!)
          cache.set(key, {
            locations,
            expires: now() + (locations.length ? 86400000 : 600000),
          })
          return locations
        })
        .finally(() => pending.delete(key))
      pending.set(key, request)
    }
    return { query, locations: await request }
  }
}
