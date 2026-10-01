import { useCallback, type ReactNode } from 'react'
import type { Action, GameEvent } from 'shared'
import type { Ready } from '../useGame.ts'
import type { RunReady } from './useRun.ts'

/** The run's battle in the shape the tables play, so both play it unchanged; null off the board. */
export function useRunBattle(run: RunReady, ending: ReactNode | null): Ready | null {
  const { act: runAct, subscribe: runSubscribe } = run
  const act = useCallback((action: Action) => runAct({ type: 'play', action }), [runAct])
  const subscribe = useCallback(
    (listener: (events: GameEvent[]) => void) =>
      runSubscribe((events) => {
        const battle = events.flatMap((event) => (event.type === 'battle' ? event.events : []))
        if (battle.length) listener(battle)
      }),
    [runSubscribe],
  )
  const visit = run.state.visit
  if (visit?.kind !== 'battle') return null
  return {
    status: 'ready',
    id: run.id,
    generation: run.generation,
    moves: run.moves,
    state: visit.game,
    log: run.log,
    unsaved: run.unsaved,
    saving: run.saving,
    result: null,
    act,
    forfeit: run.abandon,
    subscribe,
    run: { ending },
  }
}
