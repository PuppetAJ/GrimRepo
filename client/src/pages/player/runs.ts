import type { Run } from '../../components/charts/chart.ts'

/** A fake commit hash derived from when the run ended, so it never changes. */
export function hashOf(run: Run): string {
  let hash = 2166136261
  for (const letter of run.playedAt) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}
