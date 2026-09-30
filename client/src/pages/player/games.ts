import type { PlayerStats } from '../../lib/api.ts'

export type Game = PlayerStats['recent'][number]

/** A fake commit hash derived from when the game ended, so it never changes. */
export function hashOf(game: Game): string {
  let hash = 2166136261
  for (const letter of game.playedAt) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

export const messageOf = (game: Game) =>
  game.forfeited
    ? `Forfeit to P03 on turn ${game.turns}`
    : game.outcome === 'win'
      ? `Won in ${game.turns} ${game.turns === 1 ? 'turn' : 'turns'}`
      : `Lost on turn ${game.turns}`
