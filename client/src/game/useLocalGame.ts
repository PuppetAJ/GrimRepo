import { useCallback, useRef, useState } from 'react'
import { apply, type Action, type GameState } from 'shared'
import { narrate } from '../lib/narrate.ts'
import type { Listener, Ready } from './ready.ts'

let generations = 0

/** A battle played here and never saved, from a fixed state, for checking how a table holds it. */
export function useLocalGame(start: GameState, opening: string[]): Ready {
  const [played, setPlayed] = useState({ state: start, log: opening, moves: 0 })
  const [generation] = useState(() => (generations += 1))
  const listeners = useRef(new Set<Listener>())
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => void listeners.current.delete(listener)
  }, [])
  const act = useCallback(
    (action: Action) => {
      const outcome = apply(played.state, action)
      if (!outcome.ok) return
      for (const listener of listeners.current) listener(outcome.events)
      setPlayed({
        state: outcome.state,
        log: [...played.log, ...narrate(played.state, outcome.events).map((line) => `P03> ${line}`)],
        moves: played.moves + 1,
      })
    },
    [played],
  )
  return {
    status: 'ready',
    id: -1,
    generation,
    moves: played.moves,
    state: played.state,
    log: played.log,
    unsaved: 0,
    saving: false,
    act,
    forfeit: async () => {},
    subscribe,
  }
}
