import { useEffect, useRef, useState, type ReactNode } from "react"
import logisticsPhotos from "../data/logisticsPhotos"

interface TouchOrigin {
  x: number
  y: number
}

export default function PhotoCarousel({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [loadedSources, setLoadedSources] = useState<string[]>([])
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [visibleIndex, setVisibleIndex] = useState(0)
  const touchStart = useRef<TouchOrigin | null>(null)
  const photo = logisticsPhotos[index]
  const total = logisticsPhotos.length
  const failed = failedSources.includes(photo.src)
  const pending = !loadedSources.includes(photo.src) && !failed
  const move = (offset: number) =>
    setIndex((current) => (current + offset + total) % total)
  useEffect(() => {
    // Keep the last decoded photo visible while the requested photo loads.
    if (!pending) setVisibleIndex(index)
  }, [index, pending])

  return (
    <section
      className="public-hero photo-carousel"
      aria-roledescription="carousel"
      aria-label="Logistics in motion"
      aria-describedby="carousel-instructions"
      tabIndex={0}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current
        const end = event.changedTouches[0]
        touchStart.current = null
        if (!start || !end) return
        const dx = end.clientX - start.x
        const dy = end.clientY - start.y
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5)
          move(dx < 0 ? 1 : -1)
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return
        event.preventDefault()
        if (event.key === "Home") setIndex(0)
        else if (event.key === "End") setIndex(total - 1)
        else move(event.key === "ArrowRight" ? 1 : -1)
      }}
    >
      <p className="sr-only" id="carousel-instructions">
        Explore four logistics photos. Use the previous and next buttons, the
        left and right arrow keys, or swipe on the photo. Photos advance only
        when you choose.
      </p>
      <figure
        className="hero-background"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${total}: ${photo.category}`}
        aria-describedby="hero-photo-description"
        aria-busy={pending}
      >
        {failed && (
          <div
            className="carousel-image-fallback"
            role="img"
            aria-label={`${photo.alt}. Photo unavailable.`}
          />
        )}
        {logisticsPhotos.map((item, position) => (
          <img
            key={item.id}
            src={item.src}
            alt={position === visibleIndex && !failed ? item.alt : ""}
            aria-hidden={position !== visibleIndex || failed}
            data-visible={position === visibleIndex && !failed}
            width={item.width}
            height={item.height}
            fetchPriority={position === 0 ? "high" : "low"}
            onLoad={() =>
              setLoadedSources((sources) =>
                sources.includes(item.src) ? sources : [...sources, item.src],
              )
            }
            onError={() =>
              setFailedSources((sources) =>
                sources.includes(item.src) ? sources : [...sources, item.src],
              )
            }
          />
        ))}
        <figcaption className="sr-only">{photo.title}</figcaption>
      </figure>
      <div className="public-hero-inner">
        {children}
        <div className="hero-carousel-footer">
          <div className="hero-slide-copy">
            <div aria-live="polite" aria-atomic="true">
              <div key={photo.id} className="hero-caption-enter">
                <span className="hero-slide-category">
                  {failed ? "Photo unavailable" : photo.category}
                </span>
                <h2>{photo.title}</h2>
                <p id="hero-photo-description">{photo.description}</p>
              </div>
            </div>
            <a
              className="hero-photo-source"
              href={photo.source}
              target="_blank"
              rel="noreferrer"
            >
              Photo: {photo.photographer} / Unsplash ↗
            </a>
          </div>
          <div className="carousel-toolbar">
            <span className="carousel-photo-count" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}{" "}
              <span>/ {String(total).padStart(2, "0")}</span>
            </span>

            <div
              className="carousel-selectors"
              role="group"
              aria-label="Choose a logistics photo"
            >
              {logisticsPhotos.map((item, position) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`Show photo ${position + 1}: ${item.category}`}
                  aria-current={position === index ? "true" : undefined}
                  onClick={() => setIndex(position)}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="carousel-arrows">
              <button
                className="icon-button"
                type="button"
                aria-label="Previous logistics photo"
                onClick={() => move(-1)}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 12H4m6-6-6 6 6 6" />
                </svg>
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="Next logistics photo"
                onClick={() => move(1)}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12h16m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
