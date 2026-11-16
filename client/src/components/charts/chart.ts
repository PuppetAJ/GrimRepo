import { STAGES } from 'shared'
import type { PlayerStats } from '../../lib/api.ts'

export type Run = PlayerStats['recent'][number]

const battles = (run: Run) => `${run.battles} ${run.battles === 1 ? 'battle' : 'battles'} won`

export const colorOf = (run: Run) => (run.outcome === 'win' ? 'var(--primary)' : 'var(--death)')
export const resultOf = (run: Run) => (run.outcome === 'win' ? 'cleared' : 'lost')
export const ending = (run: Run) =>
  run.outcome === 'win'
    ? `Cleared ${STAGES[STAGES.length - 1]}, ${battles(run)}`
    : `${run.forfeited ? 'Abandoned' : 'Lost'} in ${STAGES[run.stage] ?? STAGES[0]}, ${battles(run)}`
