import { useEffect, useRef } from 'react'

/** E rings the bell, except while typing. */
export function useBellKey(canPress: boolean, ring: () => void) {
  const latest = useRef(ring)
  useEffect(() => {
    latest.current = ring
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement).tagName === 'INPUT') return
      if (canPress) latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPress])
}
