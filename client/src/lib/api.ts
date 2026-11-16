import type { DeathChoice, Outcome, RunAction, RunNote } from 'shared'

export type LeaderboardRow = { rank: number; username: string; bestScore: number; runs: number; wins: number }
export type BoardPage = { players: LeaderboardRow[]; page: number; pages: number; total: number; top: number }

export type PlayerStats = {
  username: string
  joinedAt: string
  runs: number
  wins: number
  losses: number
  winRate: number | null
  bestScore: number
  averageBattles: number | null
  days: { date: string; runs: number; losses: number }[]
  recent: FinishedRun[]
  best: FinishedRun | null
  rank: number | null
  favoriteCard: string | null
  deathCard: string | null
}

export type FinishedRun = {
  outcome: Outcome
  stage: number
  battles: number
  bosses: number
  score: number
  forfeited: boolean
  playedAt: string
}
export type RunsPage = { runs: FinishedRun[]; page: number; pages: number; total: number }

export type OpenRun = {
  id: number
  seed: number
  actions: RunAction[]
  resumed: boolean
  rulesChanged: boolean
  death: string | null
  rival: { card: string; by: string } | null
}
export type BuiltDeathCard = { card: string; saved: boolean; guest?: boolean }
export type Notes = { seen: RunNote[]; off: boolean }
export type NotesChange = { seen?: RunNote[]; off?: boolean; reset?: boolean }
export type RunOver = { status: 'won' | 'lost'; score: number; stage: number; bosses: number; forfeited: boolean }
export type RunSaved = { status: 'playing'; saved: number } | RunOver

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
  leaderboard: (page = 1) => request<BoardPage>(`/api/leaderboard?page=${page}`),
  stats: (username: string) => request<PlayerStats>(`/api/players/${encodeURIComponent(username)}/stats`),
  runs: (username: string, page: number) =>
    request<RunsPage>(`/api/players/${encodeURIComponent(username)}/runs?page=${page}`),
  startRun: () => request<OpenRun>('/api/runs', { method: 'POST' }),
  saveRunMoves: (id: number, from: number, actions: RunAction[]) =>
    request<RunSaved>(`/api/runs/${id}/moves`, { method: 'POST', body: JSON.stringify({ from, actions }) }),
  forfeitRun: (id: number) => request<RunOver>(`/api/runs/${id}/forfeit`, { method: 'POST' }),
  buildDeathCard: (id: number, choice: DeathChoice) =>
    request<BuiltDeathCard>(`/api/runs/${id}/death-card`, { method: 'POST', body: JSON.stringify(choice) }),
  notes: () => request<Notes>('/api/notes'),
  changeNotes: (change: NotesChange) => request<Notes>('/api/notes', { method: 'PATCH', body: JSON.stringify(change) }),
}
