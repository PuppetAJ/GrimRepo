import type { RunState } from 'shared'
import type { Aftermath } from './useRun.ts'

export type RunView =
  | 'battle'
  | 'map'
  | 'start'
  | 'pack'
  | 'card'
  | 'blind'
  | 'shop'
  | 'reward'
  | 'campfire'
  | 'stones'
  | 'event'
  | 'lint'
  | 'fuse'
  | 'item'
  | 'summary'

/** Which screen a run is on. A run that ends with its battle decided stays on the board until the player asks for the summary. */
export function runView(state: RunState, aftermath: Aftermath | null, reviewing: boolean): RunView {
  const visit = state.visit
  const battle = visit?.kind === 'battle'
  const decided = battle && visit.game.status !== 'playing'
  // An abandoned run ends with its battle undecided, so there's no final board to look at first.
  if (state.status !== 'playing' && (reviewing || !battle || !decided)) return 'summary'
  if (battle) return 'battle'
  // A decided event stays up, saying what happened, until the player moves on.
  const after = state.status === 'playing' ? aftermath : null
  if (after) return after.kind === 'event' ? 'event' : after.view
  return visit?.kind ?? 'map'
}
