import type { PlayerStats } from '../../lib/api.ts'

const DAYS = 26 * 7
export const levels = ['bg-muted', 'bg-[#2b4a2a]', 'bg-[#3f7a3b]', 'bg-[#62a95a]', 'bg-primary']

export function level(runs: number): number {
  if (runs === 0) return 0
  if (runs === 1) return 1
  if (runs === 2) return 2
  return runs <= 4 ? 3 : 4
}

/** 26 weeks of days, oldest first; `bad` means more losses than wins. */
export function grid(days: PlayerStats['days']) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  return [...Array(DAYS).keys()].map((offset) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - offset)),
    )
    const key = date.toISOString().slice(0, 10)
    const day = byDate.get(key)
    const runs = day?.runs ?? 0
    return { key, runs, bad: runs > 0 && (day?.losses ?? 0) > runs / 2 }
  })
}

export type Cell = ReturnType<typeof grid>[number]
