import { useEffect, useSyncExternalStore } from 'react'

export type Said = { lines: readonly string[]; path: string }

// What P03 is saying on the page open now, and where; each page sets its own lines.
let said: Said = { lines: [], path: '/' }
const listeners = new Set<() => void>()

function set(lines: readonly string[]) {
  said = { lines, path: window.location.pathname }
  for (const listener of listeners) listener()
}

export function useP03Lines(): Said {
  return useSyncExternalStore(
    (changed) => {
      listeners.add(changed)
      return () => listeners.delete(changed)
    },
    () => said,
  )
}

/** Gives P03 his lines for as long as the calling page is open; null while the page is still loading them. */
export function useP03Says(next: readonly string[] | null) {
  const key = next?.join('\n') ?? null
  useEffect(() => {
    if (key === null) return
    set(key.split('\n'))
    return () => set([])
  }, [key])
}
