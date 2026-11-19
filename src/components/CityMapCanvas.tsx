import { useEffect, useRef } from "react"
import * as L from "leaflet"
import type { CityLocation } from "../location-types"

interface CityMapCanvasProps {
  location: CityLocation
  interactive: boolean
  recenter: number
  onTileError: (failed: boolean) => void
}

export default function CityMapCanvas({
  location,
  interactive,
  recenter,
  onTileError,
}: CityMapCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!container.current) return
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const map = L.map(container.current, {
      center: [location.latitude, location.longitude],
      zoom: 11,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      boxZoom: false,
      zoomAnimation: !motion.matches,
      fadeAnimation: !motion.matches,
      markerZoomAnimation: !motion.matches,
    })
    instance.current = map
    L.control.zoom({ position: "topright" }).addTo(map)
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        referrerPolicy: "strict-origin-when-cross-origin",
        updateWhenIdle: true,
        keepBuffer: 1,
      },
    )
    let loaded = 0
    onTileError(false)
    tiles.on("tileload", () => {
      loaded++
      onTileError(false)
    })
    tiles.on("tileerror", () => {
      if (!loaded) onTileError(true)
    })
    tiles.addTo(map)
    const label = document.createElement("span")
    label.textContent = location.name
    L.circleMarker([location.latitude, location.longitude], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#004717",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(label, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "location-map-label",
      })
    const resize = new ResizeObserver(() =>
      map.invalidateSize({ pan: false, animate: false }),
    )
    resize.observe(container.current)
    const frame = requestAnimationFrame(() => map.invalidateSize())
    const updateMotion = () => {
      map.stop()
      map.options.zoomAnimation = !motion.matches
      map.options.fadeAnimation = !motion.matches
    }
    motion.addEventListener("change", updateMotion)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      motion.removeEventListener("change", updateMotion)
      map.remove()
      instance.current = null
    }
  }, [
    location.id,
    location.latitude,
    location.longitude,
    location.name,
    onTileError,
  ])
  useEffect(() => {
    const map = instance.current
    if (!map) return
    for (const handler of [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.keyboard,
    ]) {
      if (interactive) handler.enable()
      else handler.disable()
    }
  }, [interactive, location.id])
  useEffect(() => {
    instance.current?.setView([location.latitude, location.longitude], 11, {
      animate: false,
    })
  }, [recenter, location.id, location.latitude, location.longitude])
  return (
    <div
      ref={container}
      className="location-map-canvas"
      role="region"
      aria-label={
        location.name +
        " city overview map. " +
        (interactive
          ? "Use arrow keys to pan and plus or minus to zoom."
          : "Enable Explore map to pan. Zoom controls are available.")
      }
      tabIndex={interactive ? 0 : -1}
    />
  )
}
