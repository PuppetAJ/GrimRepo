import type { PlayerStats } from '../../lib/api.ts'

const DAYS = 26 * 7
export const levels = ['bg-muted', 'bg-[#2b4a2a]', 'bg-[#3f7a3b]', 'bg-[#62a95a]', 'bg-primary']

export function level(games: number): number {
  if (games === 0) return 0
  if (games === 1) return 1
  if (games === 2) return 2
  return games <= 4 ? 3 : 4
}

/** Half a year of days, oldest first, each with how much was played and whether it went badly. */
export function grid(days: PlayerStats['days']) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  return [...Array(DAYS).keys()].map((offset) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - offset)),
    )
    const key = date.toISOString().slice(0, 10)
    const day = byDate.get(key)
    const games = day?.games ?? 0
    return { key, games, bad: games > 0 && (day?.losses ?? 0) > games / 2 }
  })
}

export type Cell = ReturnType<typeof grid>[number]
