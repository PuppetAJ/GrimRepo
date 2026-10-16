import { useSyncExternalStore } from 'react'
import { useMedia } from '../lib/useMedia.ts'

const KEY = 'grimrepo:wide-table'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'wide'
  } catch {
    return false
  }
}

let wide = typeof window !== 'undefined' && read()

function setWide(next: boolean): void {
  wide = next
  try {
    localStorage.setItem(KEY, next ? 'wide' : 'site')
  } catch {
    // Storage can be refused in a private window; the choice then lasts until the page closes.
  }
  for (const listener of listeners) listener()
}

/** Wider than the site's own width, where the 3D table can grow past it. */
export const ROOM_TO_WIDEN = '(min-width: 100rem)'

/**
 * Whether the 3D table takes the window's width, up to 21:9, rather than the site's; remembered, and offered only
 * when the window is wide enough for it to matter.
 */
export function useWideTable(): { wide: boolean; offered: boolean; toggle: () => void } {
  const chosen = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => wide,
    () => false,
  )
  const offered = useMedia(ROOM_TO_WIDEN)
  return { wide: chosen && offered, offered, toggle: () => setWide(!chosen) }
}
