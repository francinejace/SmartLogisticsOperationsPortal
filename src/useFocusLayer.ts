import { useEffect, useRef } from "react"

export default function useFocusLayer(
  open: boolean,
  close: () => void,
  modal = false,
) {
  const ref = useRef<HTMLElement | null>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    if (modal) document.body.style.overflow = "hidden"
    const getControls = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => getControls()[0]?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== "Tab") return
      const controls = getControls()
      const first = controls[0],
        last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (
        !modal &&
        !ref.current?.contains(target) &&
        !target.closest("[data-layer-trigger]")
      )
        closeRef.current()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onOutside)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onOutside)
      if (modal) document.body.style.overflow = previousOverflow
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true })
      else
        document
          .querySelector<HTMLButtonElement>(".menu-button")
          ?.focus({ preventScroll: true })
    }
  }, [open, modal])
  return ref
}
