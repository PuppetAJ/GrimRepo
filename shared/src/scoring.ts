export type Outcome = 'win' | 'loss'

/** A win at or past this many turns earns no speed bonus. */
export const SCORE_TURN_BASELINE = 30

/** Quick-battle score (D12): faster wins score higher, and a loss is worth its turns survived. */
export function scoreBattle(outcome: Outcome, turns: number): number {
  if (!Number.isInteger(turns) || turns < 1) throw new RangeError(`turns must be a whole number above 0, got ${turns}`)
  if (outcome === 'loss') return turns * 10
  return 1000 + Math.max(0, SCORE_TURN_BASELINE - turns) * 250
}
