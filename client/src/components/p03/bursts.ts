import { useCallback, useEffect, useRef, useState } from 'react'

export type Band = { top: number; height: number; shift: number }
export type Burst = { bands: Band[]; jolt: number; slip: number }

// One frame of interference, then clear: never more than one flash, and seconds apart.
const LENGTH_MS = 140
const EVERY_MS = 3500
const SPREAD_MS = 5000

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function roll(big: boolean): Burst {
  const count = big ? 3 : 1 + Math.floor(Math.random() * 2)
  const bands = [...Array(count).keys()].map(() => ({
    top: Math.random() * 95,
    height: 2 + Math.random() * (big ? 14 : 6),
    shift: (Math.random() - 0.5) * (big ? 40 : 16),
  }))
  return { bands, jolt: (Math.random() - 0.5) * (big ? 10 : 4), slip: big ? -4 : 0 }
}

/** Now and then a burst of bad signal on P03's screen, and one on demand; none under reduced motion. */
export function useBursts(): [Burst | null, (big?: boolean) => void] {
  const [burst, setBurst] = useState<Burst | null>(null)
  const clearing = useRef(0)

  const fire = useCallback((big = false) => {
    if (still()) return
    setBurst(roll(big))
    window.clearTimeout(clearing.current)
    clearing.current = window.setTimeout(() => setBurst(null), LENGTH_MS)
  }, [])

  useEffect(() => {
    if (still()) return
    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          // About one in five is a bigger one, with the picture slipping.
          fire(Math.random() < 0.2)
          next()
        },
        EVERY_MS + Math.random() * SPREAD_MS,
      )
    }
    next()
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearing.current)
    }
  }, [fire])

  return [burst, fire]
}

const SWAPS: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', r: 'Я', '-': '_', '/': '\\' }

/** A line with some of its letters knocked into lookalikes, for a burst. */
export const garble = (line: string): string =>
  [...line].map((letter) => (SWAPS[letter] && Math.random() < 0.5 ? SWAPS[letter] : letter)).join('')
