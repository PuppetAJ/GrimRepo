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

export function runView(state: RunState, aftermath: Aftermath | null, reviewing: boolean): RunView {
  const visit = state.visit
  const battle = visit?.kind === 'battle'
  const decided = battle && visit.game.status !== 'playing'
  if (state.status !== 'playing' && (reviewing || !battle || !decided)) return 'summary'
  if (battle) return 'battle'
  const after = state.status === 'playing' ? aftermath : null
  if (after) return after.kind === 'event' ? 'event' : after.view
  return visit?.kind ?? 'map'
}
