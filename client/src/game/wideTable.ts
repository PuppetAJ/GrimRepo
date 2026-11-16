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
  } catch {}
  for (const listener of listeners) listener()
}

export const ROOM_TO_WIDEN = '(min-width: 100rem)'

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
