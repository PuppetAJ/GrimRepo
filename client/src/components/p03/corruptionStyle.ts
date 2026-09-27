import { useSyncExternalStore } from 'react'

// Development only, to compare: corruption inside the frames and out past them, inside only, or inside with the frames
// themselves damaged. Everywhere else it is always 'out'.
export type CorruptionStyle = 'out' | 'in' | 'frame'

const KEY = 'grimrepo:corruption'
const listeners = new Set<() => void>()

function read(): CorruptionStyle {
  if (!import.meta.env.DEV) return 'out'
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'in' || saved === 'frame' ? saved : 'out'
  } catch {
    return 'out'
  }
}

export function setCorruptionStyle(style: CorruptionStyle) {
  try {
    localStorage.setItem(KEY, style)
  } catch {
    // Kept only until the page reloads.
  }
  for (const listener of listeners) listener()
}

export function useCorruptionStyle(): CorruptionStyle {
  return useSyncExternalStore((changed) => {
    listeners.add(changed)
    return () => listeners.delete(changed)
  }, read)
}
