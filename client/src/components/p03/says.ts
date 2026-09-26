import { useEffect, useSyncExternalStore } from 'react'

// What P03 is saying on the page open now; each page sets its own lines.
let lines: readonly string[] = []
const listeners = new Set<() => void>()

function set(next: readonly string[]) {
  lines = next
  for (const listener of listeners) listener()
}

export function useP03Lines(): readonly string[] {
  return useSyncExternalStore(
    (changed) => {
      listeners.add(changed)
      return () => listeners.delete(changed)
    },
    () => lines,
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
