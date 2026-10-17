import { useEffect, useRef, useState } from 'react'
import { TIP, type Face } from 'shared'
import type { View } from './view.ts'

/** How far a turn's hits, added up, must swing the scale toward the player to upset him. */
const UPSET_AT = 8
/** How long he screams as the player's lead first nears his tip point, in milliseconds. */
const SCREAM_MS = 3000

/**
 * The face P03 makes at the battle, on both tables. Only big moments move him: a big hit, the player's lead nearing his
 * tip point, his desperate play, and the end.
 */
export function useP03Face(view: View, outcome: 'win' | 'loss' | undefined): Face {
  const [choking, setChoking] = useState(false)
  const [screaming, setScreaming] = useState(false)
  const scale = view.scale
  const danger = scale >= TIP - 6
  // The turn's lowest point so far, so 4, 4 and 2 in one turn upset him as much as one hit of 10. Once a turn is enough.
  const turn = useRef({ turn: view.turn, low: scale, upset: false })
  useEffect(() => {
    const now = turn.current
    // Turn 0 is the room's view between battles, so going to or from it is no hit, as when looking back from the map.
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
  // A scream as the lead first crosses into danger, settling into a glare for as long as it stays there.
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
  // Once he has made his desperate play, he glares for the rest of the battle.
  if (view.desperate) return 'impatient'
  if (danger) return screaming ? 'dying' : 'impatient'
  return 'neutral'
}

/** His face in a word, for the text table's monitor and a screen reader. */
export const FACE_WORDS: Record<Face, string> = {
  neutral: 'smug',
  happy: 'gloating',
  impatient: 'glaring',
  choking: 'choking',
  dying: 'screaming',
  whiteflag: 'surrendering',
}
