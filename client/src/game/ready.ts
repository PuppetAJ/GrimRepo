import type { ReactNode } from 'react'
import type { Action, Face, GameEvent, GameState } from 'shared'
import type { Blurb } from './tutorial/TutorialBlurb.tsx'

export type Game =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      /** Counts every deal and reload, so a table can tell a fresh start from a move. */
      generation: number
      /** Every move made, saved or not. */
      moves: number
      state: GameState
      log: string[]
      unsaved: number
      saving: boolean
      act: (action: Action) => void
      forfeit: () => Promise<void>
      subscribe: (listener: Listener) => () => void
      /** Set for a battle in a run, whose panel ends it and whose forfeit abandons the run; `note` is P03's first-time note. */
      run?: { ending: ReactNode | null; note?: Blurb | null }
      tutorial?: Tutorial
    }

export type Tutorial = {
  face: Face
  legal: (state: GameState) => Action[]
  /** Null once the battle is won. */
  blurb: Blurb | null
  ending: ReactNode | null
}

export type Ready = Extract<Game, { status: 'ready' }>

export type Listener = (events: GameEvent[]) => void
