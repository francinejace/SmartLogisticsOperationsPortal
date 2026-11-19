import { lazy, Suspense, useEffect, useId, useRef, useState } from "react"
import { api, errorMessage } from "../api"
import type { CityLocation, LocationSearchResult } from "../location-types"
import Card, { Icon } from "./PortalUI"

const CityMapCanvas = lazy(() => import("./CityMapCanvas"))
const cityCache = new Map<string, {
  result: LocationSearchResult
  expires: number
}>()

export default function DestinationMap({
  destination,
}: {
  destination: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const fieldId = useId()
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState(destination.slice(0, 120))
  const [draft, setDraft] = useState(destination.slice(0, 120))
  const [editing, setEditing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  )
  const [locations, setLocations] = useState<CityLocation[]>([])
  const [selection, setSelection] = useState(0)
  const [error, setError] = useState("")
  const [interactive, setInteractive] = useState(false)
  const [recenter, setRecenter] = useState(0)
  const [tileRevision, setTileRevision] = useState(0)
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const location = locations.find((item) => item.id === selection)

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "160px" },
    )
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    setPhase("loading")
    setError("")
    setInteractive(false)
    const key = query.trim().toLowerCase()
    const saved = cityCache.get(key)
    const request =
      saved && saved.expires > Date.now()
        ? Promise.resolve(saved.result)
        : api<LocationSearchResult>(
            "v1/locations?city=" + encodeURIComponent(query),
            { signal: controller.signal },
          )
    void request
      .then((result) => {
        if (controller.signal.aborted) return
        if (cityCache.size >= 128)
          cityCache.delete(cityCache.keys().next().value!)
        cityCache.set(key, { result, expires: Date.now() + 600000 })
        setLocations(result.locations)
        setSelection(result.locations[0]?.id ?? 0)
        setPhase(result.locations.length ? "ready" : "empty")
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setLocations([])
        setError(errorMessage(cause))
        setPhase("error")
      })
    return () => controller.abort()
  }, [visible, query, attempt])
  const retry = () => {
    cityCache.delete(query.trim().toLowerCase())
    setAttempt((value) => value + 1)
  }
  return (
    <div ref={root} className="destination-map-root">
      <Card className="destination-map">
        <div className="destination-map-heading">
          <span className="location-map-symbol">
            <Icon name="location" size={20} />
          </span>
          <div>
            <h2>Destination map</h2>
            <p>City overview</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Find another city on the map"
            aria-expanded={editing}
            aria-controls={fieldId}
            onClick={() => setEditing((value) => !value)}
          >
            <Icon name="search" size={19} />
          </button>
        </div>
        <div
          id={fieldId}
          hidden={!editing && phase !== "empty" && phase !== "error"}
        >
          <form
            className="location-city-search"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(draft.trim())
              setAttempt((value) => value + 1)
              setEditing(false)
            }}
          >
            <label htmlFor={fieldId + "-city"}>City or municipality</label>
            <div>
              <input
                id={fieldId + "-city"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                minLength={2}
                maxLength={120}
                required
              />
              <button type="submit" className="button secondary">
                Find city
              </button>
            </div>
          </form>
        </div>
        {phase === "loading" && (
          <div className="location-map-placeholder" role="status">
            <Icon name="location" size={26} />
            <p>Finding {query}…</p>
          </div>
        )}
        {phase === "empty" && (
          <div className="location-map-placeholder" role="status">
            <Icon name="search" size={26} />
            <strong>No city match found</strong>
            <p>Try the city name with its province or country.</p>
          </div>
        )}
        {phase === "error" && (
          <div className="location-map-placeholder" role="status">
            <Icon name="location" size={26} />
            <strong>Map unavailable</strong>
            <p>{error}</p>
            <button className="text-button" onClick={retry}>
              Try again <Icon name="refresh" size={16} />
            </button>
          </div>
        )}
        {phase === "ready" && location && (
          <>
            <div className="location-map-summary">
              <strong>{location.name}</strong>
              <span>
                {[location.region, location.country]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {locations.length > 1 && (
              <label className="location-choice">
                Choose city match
                <select
                  value={selection}
                  onChange={(event) => {
                    setSelection(Number(event.target.value))
                    setInteractive(false)
                  }}
                >
                  {locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.name, item.region, item.country]
                        .filter(Boolean)
                        .join(", ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="location-map-toolbar">
              <button
                className="button secondary"
                aria-pressed={interactive}
                onClick={() => setInteractive((value) => !value)}
              >
                <Icon name="location" size={16} />
                {interactive ? "Lock map" : "Explore map"}
              </button>
              <button
                className="text-button"
                onClick={() => setRecenter((value) => value + 1)}
              >
                Recenter <Icon name="refresh" size={15} />
              </button>
            </div>
            <div className="location-map-frame">
              <Suspense
                fallback={
                  <div className="location-map-placeholder" role="status">
                    Loading map…
                  </div>
                }
              >
                <CityMapCanvas
                  key={tileRevision}
                  location={location}
                  interactive={interactive}
                  recenter={recenter}
                  onTileError={setTilesUnavailable}
                />
              </Suspense>
            </div>
            {tilesUnavailable && (
              <p className="location-map-notice" role="status">
                Map tiles could not load.{" "}
                <button
                  className="text-button"
                  onClick={() => setTileRevision((value) => value + 1)}
                >
                  Retry tiles
                </button>{" "}
                or open the external map.
              </p>
            )}
            <div className="location-map-meta">
              <span>
                {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}
                °
              </span>
              <a
                href={
                  "https://www.openstreetmap.org/?mlat=" +
                  location.latitude +
                  "&mlon=" +
                  location.longitude +
                  "#map=11/" +
                  location.latitude +
                  "/" +
                  location.longitude
                }
                target="_blank"
                rel="noreferrer"
              >
                Open map ↗
              </a>
            </div>
          </>
        )}
        <p className="location-map-note">
          Approximate city center. This map does not show a live shipment
          position.
        </p>
        {query !== destination && (
          <p className="location-map-note">
            Saved destination: <strong>{destination}</strong>. Map searches do
            not change the order.
          </p>
        )}
        <p className="location-map-credit">
          City data:{" "}
          <a
            href="https://open-meteo.com/en/docs/geocoding-api"
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo
          </a>{" "}
          /{" "}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
        </p>
      </Card>
    </div>
  )
}
