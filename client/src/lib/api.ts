import type { Action, Outcome } from 'shared'

export type LeaderboardRow = { rank: number; username: string; bestScore: number; games: number; wins: number }

export type PlayerStats = {
  username: string
  joinedAt: string
  games: number
  wins: number
  losses: number
  winRate: number | null
  bestScore: number
  bestWinTurns: number | null
  averageTurns: number | null
  days: { date: string; games: number; losses: number }[]
  recent: { outcome: Outcome; turns: number; score: number; forfeited: boolean; playedAt: string }[]
}

export type OpenGame = { id: number; seed: number; actions: Action[]; resumed: boolean; rulesChanged: boolean }

export type Finished = {
  status: 'finished'
  outcome: Outcome
  turns: number
  score: number
  best: number
  isBest: boolean
}
export type Saved = { status: 'playing'; saved: number } | Finished

export class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body['error'] === 'string' ? body['error'] : `Request failed (${status})`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

export const api = {
  leaderboard: () => request<{ players: LeaderboardRow[] }>('/api/leaderboard').then((body) => body.players),
  stats: (username: string) => request<PlayerStats>(`/api/players/${encodeURIComponent(username)}/stats`),
  startGame: () => request<OpenGame>('/api/games', { method: 'POST' }),
  saveMoves: (id: number, from: number, actions: Action[]) =>
    request<Saved>(`/api/games/${id}/moves`, { method: 'POST', body: JSON.stringify({ from, actions }) }),
  forfeit: (id: number) => request<Finished>(`/api/games/${id}/forfeit`, { method: 'POST' }),
}
