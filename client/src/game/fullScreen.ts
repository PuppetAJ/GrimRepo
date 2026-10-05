import { useEffect, useState } from 'react'

/** Leaves full screen when the page that entered it goes, not when one of its screens is swapped for another. */
export function useLeaveFullScreen() {
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen()
    },
    [],
  )
}

/** Full-screens the page, not the canvas, so dialogs still show; `fallback` covers the page on iPhones. */
export function useFullScreen({ fallback = false } = {}) {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement))
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const native = document.fullscreenEnabled
  const toggle = () =>
    !native
      ? setCovering((now) => !now)
      : document.fullscreenElement
        ? void document.exitFullscreen()
        : void document.documentElement.requestFullscreen().catch(() => {})
  return { supported: native || fallback, on: on || covering, toggle }
}
