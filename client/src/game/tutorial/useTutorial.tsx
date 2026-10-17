import { useCallback, useMemo, useRef, useState } from 'react'
import {
  afterMove,
  afterStep,
  apply,
  expectedMove,
  tutorialActions,
  tutorialAllows,
  tutorialAt,
  tutorialStep,
  TUTORIAL_ENCOUNTER,
  type Action,
  type GameEvent,
  type GameState,
  type Progress,
} from 'shared'
import { narrate } from '../../lib/narrate.ts'
import type { Ready } from '../useGame.ts'
import { TutorialEnding } from './TutorialBlurb.tsx'

type Listener = (events: GameEvent[]) => void

type Played = { state: GameState; progress: Progress; log: string[]; moves: number }

let generations = 0

function begin(step: number): Played {
  const { state, progress } = tutorialAt(step)
  return { state, progress, log: [`P03> ${TUTORIAL_ENCOUNTER.intro}`], moves: 0 }
}

/** The tutorial's battle, played locally and never saved: only the move its step waits for gets through. */
export function useTutorial(start = 0): Ready {
  const [played, setPlayed] = useState(() => begin(start))
  const [generation] = useState(() => (generations += 1))
  const listeners = useRef(new Set<Listener>())
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => void listeners.current.delete(listener)
  }, [])

  const act = useCallback(
    (action: Action) => {
      // Anything but the awaited move is quietly ignored; the drawer already says what to do.
      if (!tutorialAllows(played.state, played.progress, action)) return
      const outcome = apply(played.state, action)
      if (!outcome.ok) return
      for (const listener of listeners.current) listener(outcome.events)
      const lines = narrate(played.state, outcome.events).map((line) => `P03> ${line}`)
      setPlayed({
        state: outcome.state,
        progress: expectedMove(played.progress) ? afterMove(played.progress) : played.progress,
        log: [...played.log, ...lines],
        moves: played.moves + 1,
      })
    },
    [played],
  )

  const pressOn = useCallback(() => setPlayed((now) => ({ ...now, progress: afterStep(now.progress) })), [])

  const step = tutorialStep(played.progress)
  const reading = Boolean(step && !step.moves && !step.free)
  const over = played.state.status !== 'playing'
  const tutorial = useMemo(
    () => ({
      face: over ? ('whiteflag' as const) : (step?.face ?? 'neutral'),
      legal: (state: GameState) => tutorialActions(state, played.progress),
      blurb: over ? null : { step, move: expectedMove(played.progress), onPressOn: reading ? pressOn : null },
      ending: over ? <TutorialEnding /> : null,
    }),
    [over, step, played.progress, reading, pressOn],
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
    result: null,
    act,
    // Leaving is a link in the drawer; there is nothing to forfeit.
    forfeit: async () => {},
    subscribe,
    tutorial,
  }
}
