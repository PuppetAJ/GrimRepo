export type Outcome = 'win' | 'loss'

/** A win at or past this many turns earns no speed bonus. */
export const SCORE_TURN_BASELINE = 30

/** Faster wins score higher; a loss is worth its turns survived. */
export function scoreBattle(outcome: Outcome, turns: number): number {
  if (!Number.isInteger(turns) || turns < 1) throw new RangeError(`turns must be a whole number above 0, got ${turns}`)
  if (outcome === 'loss') return turns * 10
  return 1000 + Math.max(0, SCORE_TURN_BASELINE - turns) * 250
}

/** A run's score: 100 a battle, 1,500 a boss (the stage and the boss), 2,000 for the clear, and 20 per point of overkill. */
export function scoreRun(record: { battles: number; bosses: number; overkill: number }, cleared: boolean): number {
  return record.battles * 100 + record.bosses * 1500 + (cleared ? 2000 : 0) + record.overkill * 20
}
