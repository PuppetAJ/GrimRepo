import type { PlayerStats } from '../../lib/api.ts'

export type Game = PlayerStats['recent'][number]

/** How many games back each point of the win trend looks. */
export const TREND_GAMES = 5

// A forfeit counts as a loss: quitting a game you're losing says nothing a loss doesn't.
export const colorOf = (game: Game) => (game.outcome === 'win' ? 'var(--primary)' : 'var(--death)')
export const resultOf = (game: Game) => (game.outcome === 'win' ? 'won' : 'lost')
export const ending = (game: Game) =>
  game.outcome === 'win' ? `Won in ${game.turns} turns` : `Lost on turn ${game.turns}`
