import { useEffect, useRef } from "react"

// Content is visible by default; the observer only adds a brief, one-time entrance.
export default function useEntranceMotion(view: string) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const targets = root.current?.querySelectorAll<HTMLElement>("[data-enter]")
    if (!targets) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let observer: IntersectionObserver | undefined
    const stop = () => {
      observer?.disconnect()
      targets.forEach((target) => target.classList.remove("motion-enter"))
    }
    const start = () => {
      stop()
      if (preference.matches || !("IntersectionObserver" in window)) return
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add("motion-enter")
            observer?.unobserve(entry.target)
          })
        },
        { threshold: 0.12 },
      )
      targets.forEach((target) => observer?.observe(target))
    }
    start()
    preference.addEventListener("change", start)
    return () => {
      stop()
      preference.removeEventListener("change", start)
    }
  }, [view])

  return root
}
