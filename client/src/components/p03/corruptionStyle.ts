import { useSyncExternalStore } from 'react'

// Development only, to compare: corruption in and out past the frames, inside only, inside with the frames damaged, or
// both out and damaged. Everywhere else it is always 'out'.
export type CorruptionStyle = 'out' | 'in' | 'frame' | 'both'

/** Whether the corruption spills out past its frames, and whether the frames are broken, for a style. */
export const spills = (style: CorruptionStyle) => style === 'out' || style === 'both'
export const breaks = (style: CorruptionStyle) => style === 'frame' || style === 'both'

const KEY = 'grimrepo:corruption'
const listeners = new Set<() => void>()

function read(): CorruptionStyle {
  if (!import.meta.env.DEV) return 'out'
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'in' || saved === 'frame' || saved === 'both' ? saved : 'out'
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
