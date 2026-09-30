import { useEffect, useState } from 'react'

/** Full-screens the page, not the canvas, so dialogs still show; `fallback` covers the page on iPhones. */
export function useFullScreen({ fallback = false } = {}) {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement))
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
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
  return { supported: native || fallback, on: on || covering, toggle }
}
