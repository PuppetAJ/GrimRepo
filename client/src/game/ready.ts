import type { ReactNode } from 'react'
import type { Action, Face, GameEvent, GameState } from 'shared'
import type { Blurb } from './tutorial/TutorialBlurb.tsx'

export type Game =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      generation: number
      moves: number
      state: GameState
      log: string[]
      unsaved: number
      saving: boolean
      act: (action: Action) => void
      forfeit: () => Promise<void>
      subscribe: (listener: Listener) => () => void
      run?: { ending: ReactNode | null; note?: Blurb | null }
      tutorial?: Tutorial
    }

export type Tutorial = {
  face: Face
  legal: (state: GameState) => Action[]
  blurb: Blurb | null
  ending: ReactNode | null
}

export type Ready = Extract<Game, { status: 'ready' }>

export type Listener = (events: GameEvent[]) => void
