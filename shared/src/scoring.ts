export type Outcome = 'win' | 'loss'

export const SCORE_TURN_BASELINE = 30

export function scoreBattle(outcome: Outcome, turns: number): number {
  if (!Number.isInteger(turns) || turns < 1) throw new RangeError(`turns must be a whole number above 0, got ${turns}`)
  if (outcome === 'loss') return turns * 10
  return 1000 + Math.max(0, SCORE_TURN_BASELINE - turns) * 250
}

export const DEATH_SKIP_BONUS = 1.25

export function scoreRun(
  record: { battles: number; bosses: number; overkill: number },
  cleared: boolean,
  bonus = 1,
): number {
  const base = record.battles * 100 + record.bosses * 1500 + (cleared ? 2000 : 0) + record.overkill * 20
  return Math.round(base * bonus)
}
