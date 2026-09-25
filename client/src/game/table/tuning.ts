import { useSyncExternalStore } from 'react'

// The scene's mood, tunable live from the panel `?mood` opens; these are the values the scene ships with.
export const TUNING = {
  exposure: 0.65,
  ambient: 0.5,
  hemisphere: 0.8,
  spot: 30,
  lamp: 25,
  p03Light: 6.5,
  deckLight: 14,
  handLight: 3,
  rackLight: 7.5,
  // How far the white lamps lean to the palette's own colour.
  lampTint: 0.7,
  fogNear: 6.5,
  fogFar: 34,
  bloom: 1.4,
  bloomThreshold: 0.85,
  bloomRadius: 0.45,
  vignette: 0.75,
  noise: 0.05,
  scanline: 0.05,
  hue: 0,
  saturation: 0,
  brightness: 0,
  contrast: 0,
  dustCount: 320,
  dustSize: 2.8,
  dustOpacity: 0.2,
  dustSpeed: 0.2,
  cardGlow: 0.65,
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
