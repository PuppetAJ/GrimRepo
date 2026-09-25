import { useSyncExternalStore } from 'react'

// The scene's mood, tunable live from the panel `?mood` opens; these are the values the scene ships with.
export const TUNING = {
  exposure: 0.95,
  ambient: 0.5,
  hemisphere: 0.8,
  spot: 46,
  lamp: 24,
  p03Light: 5.5,
  deckLight: 13,
  handLight: 5.5,
  rackLight: 6.5,
  // How far the white lamps lean to the palette's own colour.
  lampTint: 0.25,
  fogNear: 9,
  fogFar: 31,
  bloom: 1.65,
  bloomThreshold: 0.67,
  bloomRadius: 0.45,
  vignette: 0.75,
  noise: 0.1,
  scanline: 0.075,
  hue: 0,
  saturation: 0,
  brightness: 0,
  contrast: 0,
  dustCount: 210,
  dustSize: 1.7,
  dustOpacity: 0.3,
  dustSpeed: 0.2,
  cardGlow: 0.6,
  trimGlow: 0.04,
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
