import { useEffect, useRef, useState } from "react"
import logisticsPhotos from "../data/logisticsPhotos"

interface TouchOrigin {
  x: number
  y: number
}

export default function PhotoCarousel() {
  const [index, setIndex] = useState(0)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const touchStart = useRef<TouchOrigin | null>(null)
  const photo = logisticsPhotos[index]
  const total = logisticsPhotos.length
  const move = (offset: number) =>
    setIndex((current) => (current + offset + total) % total)
  useEffect(() => {
    const nextImage = new Image()
    nextImage.src = logisticsPhotos[(index + 1) % total].src
  }, [index, total])

  return (
    <section
      className="public-visual photo-carousel"
      aria-roledescription="carousel"
      aria-label="Logistics in motion"
      aria-describedby="carousel-instructions"
      tabIndex={0}
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
        className="public-photo"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${total}: ${photo.category}`}
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
      >
        {failedSource === photo.src ? (
          <div
            className="carousel-image-fallback"
            role="img"
            aria-label={photo.alt}
          >
            <span>Photo unavailable</span>
            <p>Use the controls to explore the other logistics photos.</p>
          </div>
        ) : (
          <img
            key={photo.id}
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            fetchPriority={index === 0 ? "high" : "auto"}
            onError={() => setFailedSource(photo.src)}
          />
        )}
        <span className="carousel-photo-count" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}{" "}
          <span>/ {String(total).padStart(2, "0")}</span>
        </span>
        <figcaption>
          <span>{photo.category}</span>
          <h2>{photo.title}</h2>
          <p>{photo.description}</p>
        </figcaption>
      </figure>
      <div className="carousel-toolbar">
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
      <div className="public-photo-credit">
        <span aria-live="polite" aria-atomic="true">
          Photo {index + 1} of {total} · {photo.category}
        </span>
        <a href={photo.source} target="_blank" rel="noreferrer">
          {photo.photographer} / Unsplash ↗
        </a>
      </div>
    </section>
  )
}
