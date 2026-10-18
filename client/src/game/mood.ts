import { useEffect, useRef, useState } from 'react'
import { TIP, type Face } from 'shared'
import type { View } from './view.ts'

/** How far one turn's hits must swing the scale to make P03 choke. */
const UPSET_AT = 8
/** How long P03 screams as the player's lead first nears TIP, in milliseconds. */
const SCREAM_MS = 3000

/** P03's face, shared by both tables; only big moments change it. */
export function useP03Face(view: View, outcome: 'win' | 'loss' | undefined): Face {
  const [choking, setChoking] = useState(false)
  const [screaming, setScreaming] = useState(false)
  const scale = view.scale
  const danger = scale >= TIP - 6
  // Hits add up over a turn, so 4, 4 and 2 count as one hit of 10.
  const turn = useRef({ turn: view.turn, low: scale, upset: false })
  useEffect(() => {
    const now = turn.current
    // Turn 0 is the room between battles, not a hit.
    if (view.turn !== now.turn || view.turn === 0) {
      turn.current = { turn: view.turn, low: scale, upset: false }
      return
    }
    now.low = Math.min(now.low, scale)
    if (now.upset || scale - now.low < UPSET_AT) return
    now.upset = true
    const start = setTimeout(() => setChoking(true), 0)
    setTimeout(() => setChoking(false), 1600)
    return () => clearTimeout(start)
  }, [scale, view.turn])
  useEffect(() => {
    if (!danger) return
    const start = setTimeout(() => setScreaming(true), 0)
    const stop = setTimeout(() => setScreaming(false), SCREAM_MS)
    return () => {
      clearTimeout(start)
      clearTimeout(stop)
    }
  }, [danger])
  if (outcome === 'win') return 'whiteflag'
  if (outcome === 'loss') return 'happy'
  if (choking) return 'choking'
  if (view.desperate) return 'impatient'
  if (danger) return screaming ? 'dying' : 'impatient'
  return 'neutral'
}
