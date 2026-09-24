import { useCallback, useEffect, useRef, useState } from 'react'
import { apply, type Action, type GameEvent, type GameState } from 'shared'
import { toast } from 'sonner'
import { api, ApiError, type Finished, type OpenGame } from '../lib/api.ts'
import { history, narrate } from '../lib/narrate.ts'

export type Game =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      /** Counts every deal and reload, so a table can tell a fresh start from a move. */
      generation: number
      state: GameState
      log: string[]
      unsaved: number
      saving: boolean
      result: Finished | null
      act: (action: Action) => void
      forfeit: () => Promise<void>
      /** Hears each move's events as it is made; returns the unsubscribe. */
      subscribe: (listener: Listener) => () => void
    }

export type Ready = Extract<Game, { status: 'ready' }>

type Listener = (events: GameEvent[]) => void

type Table = { id: number; generation: number; state: GameState; log: string[] }

// Enough for any real game, so the console always holds the whole story.
const LOG_LINES = 2_000

let generations = 0

function open(game: OpenGame): Table {
  const rebuilt = history(game.seed, game.actions)
  if (!rebuilt) throw new Error('This game could not be replayed. Walk away from it to start another.')
  const lines = rebuilt.lines.map((line) => `P03> ${line}`)
  // A resumed game with no moves is still a new deal, as when two requests race to start it.
  if (game.resumed && game.actions.length) lines.push(`P03> Welcome back. Turn ${rebuilt.state.turn}.`)
  if (game.rulesChanged)
    lines.unshift('P03> I rewrote the rules since your last game. It could not continue, so here is a new deal.')
  generations += 1
  return { id: game.id, generation: generations, state: rebuilt.state, log: lines.slice(-LOG_LINES) }
}

/** The open game: played here, saved at every draw and bell, and scored on the server. */
export function useGame(): Game {
  const [table, setTable] = useState<Table | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const [unsaved, setUnsaved] = useState(0)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Finished | null>(null)
  // What the server has and what has been played since; refs, so a queued save reads them when it runs.
  const saved = useRef(0)
  const pending = useRef<Action[]>([])
  const chain = useRef<Promise<void>>(Promise.resolve())
  // Told as each move is made, so a table playing the events back never misses one to batching.
  const listeners = useRef(new Set<Listener>())
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => void listeners.current.delete(listener)
  }, [])

  useEffect(() => {
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

  // Saves run one after another, each reading the refs when its turn comes, so none can overlap.
  const save = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      if (id === undefined || pending.current.length === 0) return
      const batch = [...pending.current]
      setSaving(true)
      try {
        const reply = await api.saveMoves(id, saved.current, batch)
        saved.current += batch.length
        pending.current = pending.current.slice(batch.length)
        if (reply.status === 'finished') setResult(reply)
      } catch (failure) {
        // Out of step with the server, most likely from another tab: its copy is the truth.
        if (failure instanceof ApiError && failure.status === 409) {
          toast.warning(
            failure.body['rulesChanged']
              ? 'The rules changed since this game began, so it cannot continue. Dealing a new one.'
              : 'This game moved on in another tab. Picking it up from there.',
          )
          setReloads((n) => n + 1)
        } else {
          toast.error(`Could not save: ${failure instanceof Error ? failure.message : String(failure)}`)
        }
      } finally {
        setSaving(false)
        setUnsaved(pending.current.length)
      }
    })
    return chain.current
  }, [id])

  const act = useCallback(
    (action: Action) => {
      if (!table || result) return
      const outcome = apply(table.state, action)
      if (!outcome.ok) {
        toast.error(outcome.reason)
        return
      }
      pending.current.push(action)
      setUnsaved(pending.current.length)
      for (const listener of listeners.current) listener(outcome.events)
      const lines = narrate(table.state, outcome.events).map((line) => `P03> ${line}`)
      setTable({ ...table, state: outcome.state, log: [...table.log, ...lines].slice(-LOG_LINES) })
      // A draw shows the next card, so it is saved at once; otherwise a reload could peek and draw again.
      if (action.type === 'ringBell' || action.type === 'draw') void save()
    },
    [table, result, save],
  )

  const forfeit = useCallback(async () => {
    if (id === undefined) return
    try {
      // Anything unsaved is dropped: walking away ends the game where the server last saw it.
      await chain.current
      setResult(await api.forfeit(id))
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    }
  }, [id])

  if (error) return { status: 'error', message: error }
  if (!table) return { status: 'loading' }
  return { status: 'ready', ...table, unsaved, saving, result, act, forfeit, subscribe }
}
