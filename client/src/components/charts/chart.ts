import type { PlayerStats } from '../../lib/api.ts'

export type Game = PlayerStats['recent'][number]

export const colorOf = (game: Game) =>
  game.forfeited ? 'var(--muted-foreground)' : game.outcome === 'win' ? 'var(--primary)' : 'var(--death)'
export const resultOf = (game: Game) => (game.forfeited ? 'forfeited' : game.outcome === 'win' ? 'won' : 'lost')
export const ending = (game: Game) =>
  game.forfeited
    ? `Forfeited on turn ${game.turns}`
    : game.outcome === 'win'
      ? `Won in ${game.turns} turns`
      : `Lost on turn ${game.turns}`
