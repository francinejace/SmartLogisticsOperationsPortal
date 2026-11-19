import { useId, useState } from "react"
import { createPortal } from "react-dom"
import useFocusLayer from "../useFocusLayer"
import DestinationMap from "./DestinationMap"
import { Icon } from "./PortalUI"

function LocationDialog({
  destination,
  close,
}: {
  destination: string
  close: () => void
}) {
  const title = useId()
  const ref = useFocusLayer(true, close, true)
  return createPortal(
    <div
      className="overlay location-overlay"
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (["Enter", " "].includes(event.key)) event.stopPropagation()
      }}
    >
      <section
        ref={ref}
        className="drawer location-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
      >
        <div className="location-dialog-heading">
          <div>
            <span>DESTINATION OVERVIEW</span>
            <h2 id={title}>{destination}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close destination map"
          >
            <Icon name="close" />
          </button>
        </div>
        <DestinationMap destination={destination} />
      </section>
    </div>,
    document.body,
  )
}

export default function LocationButton({
  destination,
}: {
  destination: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="location-link"
        aria-label={"View map of " + destination}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (["Enter", " "].includes(event.key)) event.stopPropagation()
        }}
      >
        <Icon name="location" size={15} />
        <span>{destination}</span>
      </button>
      {open && (
        <LocationDialog
          destination={destination}
          close={() => setOpen(false)}
        />
      )}
    </>
  )
}
