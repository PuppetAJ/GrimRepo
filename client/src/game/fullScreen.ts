import { useEffect, useState } from 'react'

/**
 * Full screen for the whole page rather than the canvas, so dialogs and toasts still show over the table. With
 * `fallback`, a browser with no full-screen API for pages (an iPhone's) gets the table covering the page instead.
 */
export function useFullScreen({ fallback = false } = {}) {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement))
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      // Leaving the table leaves full screen too.
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [])
  const native = document.fullscreenEnabled
  const toggle = () =>
    !native
      ? setCovering((now) => !now)
      : document.fullscreenElement
        ? void document.exitFullscreen()
        : void document.documentElement.requestFullscreen().catch(() => {})
  // Without the API or the fallback the button is left out.
  return { supported: native || fallback, on: on || covering, toggle }
}
