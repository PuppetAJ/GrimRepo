import { useCallback, useEffect, useRef, useState } from 'react'
import { apply, type Action, type GameEvent, type GameState } from 'shared'
import { toast } from '../lib/toast.tsx'
import { api, ApiError, type Finished, type OpenGame } from '../lib/api.ts'
import { history, narrate } from '../lib/narrate.ts'
import { fixture } from './fixtures.ts'

export type Game =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      /** Counts every deal and reload, so a table can tell a fresh start from a move. */
      generation: number
      /** Every move made, saved or not. */
      moves: number
      state: GameState
      log: string[]
      unsaved: number
      saving: boolean
      result: Finished | null
      act: (action: Action) => void
      forfeit: () => Promise<void>
      subscribe: (listener: Listener) => () => void
    }

export type Ready = Extract<Game, { status: 'ready' }>

type Listener = (events: GameEvent[]) => void

type Table = { id: number; generation: number; moves: number; state: GameState; log: string[] }

// Enough for any real game, so the console holds the whole log.
const LOG_LINES = 2_000

let generations = 0

function open(game: OpenGame): Table {
  const rebuilt = history(game.seed, game.actions)
  if (!rebuilt) throw new Error('This game could not be replayed. Forfeit it to start another.')
  const lines = rebuilt.lines.map((line) => `P03> ${line}`)
  // A resumed game with no moves is still a new deal, as when two requests race to start it.
  if (game.resumed && game.actions.length) lines.push(`P03> Oh. You came back. Turn ${rebuilt.state.turn}. Draw.`)
  if (game.rulesChanged)
    lines.unshift('P03> I patched the rules since your last game. Your old save is incompatible. New deal.')
  generations += 1
  return {
    id: game.id,
    generation: generations,
    moves: game.actions.length,
    state: rebuilt.state,
    log: lines.slice(-LOG_LINES),
  }
}

/** Plays the open game locally and saves it at every draw and bell; the server scores it. */
export function useGame(): Game {
  const [table, setTable] = useState<Table | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const [unsaved, setUnsaved] = useState(0)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Finished | null>(null)
  // Refs, so a queued save reads them when it runs, not when it was queued.
  const saved = useRef(0)
  const pending = useRef<Action[]>([])
  const chain = useRef<Promise<void>>(Promise.resolve())
  // Called on each move, so playback never loses events to React's batching.
  const listeners = useRef(new Set<Listener>())
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => void listeners.current.delete(listener)
  }, [])

  useEffect(() => {
    const fixed = fixture()
    // Deferred like a server reply, so a fixture loads the same way a game does.
    if (fixed)
      return void Promise.resolve().then(() => {
        generations += 1
        setTable({ id: -1, generation: generations, moves: 0, state: fixed.state, log: fixed.log })
        setResult(null)
      })
    let current = true
    api.startGame().then(
      (game) => {
        if (!current) return
        try {
          saved.current = game.actions.length
          pending.current = []
          setTable(open(game))
          setUnsaved(0)
          setResult(null)
          setError(null)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      },
      (failure: unknown) => current && setError(failure instanceof Error ? failure.message : String(failure)),
    )
    return () => {
      current = false
    }
  }, [reloads])

  const id = table?.id
  // Failed saves retry with backoff until they land, since a finished game has no later move to send them.
  const retry = useRef<{ timer?: ReturnType<typeof setTimeout>; wait: number }>({ wait: 0 })
  const again = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => () => clearTimeout(retry.current.timer), [])

  // Saves are chained so they never overlap; each reads the refs when it runs.
  const save = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      clearTimeout(retry.current.timer)
      if (id === undefined || pending.current.length === 0) return
      const batch = [...pending.current]
      setSaving(true)
      try {
        const reply = await api.saveMoves(id, saved.current, batch)
        saved.current += batch.length
        pending.current = pending.current.slice(batch.length)
        retry.current.wait = 0
        if (reply.status === 'finished') setResult(reply)
      } catch (failure) {
        // Out of step with the server, usually from another tab; the server's copy wins.
        if (failure instanceof ApiError && failure.status === 409) {
          toast.warning(
            failure.body['rulesChanged']
              ? "The rules changed since this game began, so it can't continue. Dealing a new one."
              : 'This game moved on in another tab. Picking it up from there.',
          )
          setReloads((n) => n + 1)
        } else {
          if (!retry.current.wait)
            toast.error(
              `Could not save: ${failure instanceof Error ? failure.message : String(failure)}. Trying again.`,
            )
          retry.current.wait = Math.min(30_000, (retry.current.wait || 1_000) * 2)
          retry.current.timer = setTimeout(() => void again.current(), retry.current.wait)
        }
      } finally {
        setSaving(false)
        setUnsaved(pending.current.length)
      }
    })
    return chain.current
  }, [id])
  useEffect(() => {
    again.current = save
  }, [save])

  const act = useCallback(
    (action: Action) => {
      if (!table || result) return
      const outcome = apply(table.state, action)
      if (!outcome.ok) {
        toast.error(outcome.reason)
        return
      }
      // Fixtures are never saved.
      if (table.id !== -1) pending.current.push(action)
      setUnsaved(pending.current.length)
      for (const listener of listeners.current) listener(outcome.events)
      const lines = narrate(table.state, outcome.events).map((line) => `P03> ${line}`)
      setTable({
        ...table,
        moves: table.moves + 1,
        state: outcome.state,
        log: [...table.log, ...lines].slice(-LOG_LINES),
      })
      // Save draws at once, or a reload could peek at the next card and draw again.
      if (action.type === 'ringBell' || action.type === 'draw') void save()
    },
    [table, result, save],
  )

  const over = table ? table.state.status !== 'playing' : false
  const forfeit = useCallback(async () => {
    if (id === undefined) return
    if (id === -1) return setReloads((n) => n + 1)
    // The result is still being saved; forfeiting now would record a loss.
    if (over) return
    try {
      // Unsaved moves are dropped; the game ends where the server last saw it.
      await chain.current
      setResult(await api.forfeit(id))
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    }
  }, [id, over])

  if (error) return { status: 'error', message: error }
  if (!table) return { status: 'loading' }
  return { status: 'ready', ...table, unsaved, saving, result, act, forfeit, subscribe }
}
