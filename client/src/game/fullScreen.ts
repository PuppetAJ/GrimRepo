import { useEffect, useState } from 'react'

/** Full screen for the whole page rather than the canvas, so dialogs and toasts still show over the table. */
export function useFullScreen() {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement))
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      // Leaving the table leaves full screen too.
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [])
  const toggle = () =>
    document.fullscreenElement
      ? void document.exitFullscreen()
      : void document.documentElement.requestFullscreen().catch(() => {})
  // iPhones have no full-screen API for pages; the button is left out there.
  return { supported: document.fullscreenEnabled, on, toggle }
}
