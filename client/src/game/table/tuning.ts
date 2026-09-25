import { useSyncExternalStore } from 'react'

// The scene's mood, tunable live from the panel `?mood` opens; these are the values the scene ships with.
export const TUNING = {
  exposure: 1,
  ambient: 0.45,
  hemisphere: 0.8,
  spot: 55,
  lamp: 18,
  p03Light: 10,
  deckLight: 10,
  handLight: 6,
  rackLight: 5,
  fogNear: 7,
  fogFar: 34,
  bloom: 1,
  bloomThreshold: 0.85,
  bloomRadius: 0.7,
  vignette: 0.7,
  noise: 0.04,
  scanline: 0.05,
  dustCount: 140,
  dustSize: 1.6,
  dustOpacity: 0.3,
  dustSpeed: 0.15,
  cardGlow: 0.75,
  trimGlow: 0.18,
}

export type Tuning = typeof TUNING
const KEY = 'grimrepo:mood'

function saved(): Tuning {
  try {
    return { ...TUNING, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Tuning>) }
  } catch {
    return { ...TUNING }
  }
}

// Only a player who opened the panel sees their own tuning; everyone else gets the scene as shipped.
let current: Tuning =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mood') ? saved() : { ...TUNING }
const listeners = new Set<() => void>()

export const tuning = (): Tuning => current

export function tune(patch: Partial<Tuning>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Storage can be refused in a private window; the tuning still holds until the page reloads.
  }
  for (const listener of listeners) listener()
}

/** The current tuning, re-rendering when the panel changes it; frame loops read `tuning()` instead. */
export function useTuning(): Tuning {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, tuning)
}
