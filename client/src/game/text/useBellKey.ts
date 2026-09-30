import { useEffect, useRef } from 'react'
import { forTable } from '../shortcuts.ts'

/** E rings the bell. */
export function useBellKey(canPress: boolean, ring: () => void) {
  const latest = useRef(ring)
  useEffect(() => {
    latest.current = ring
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat || !forTable(event)) return
      if (canPress) latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPress])
}
