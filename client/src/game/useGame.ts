import { useCallback, useEffect, useRef, useState } from 'react'
import { apply, replay, type Action, type GameState } from 'shared'
import { toast } from 'sonner'
import { api, ApiError, type Finished, type OpenGame } from '../lib/api.ts'
import { narrate } from '../lib/narrate.ts'

export type Game =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      state: GameState
      log: string[]
      unsaved: number
      saving: boolean
      result: Finished | null
      act: (action: Action) => void
      forfeit: () => Promise<void>
    }

type Table = { id: number; state: GameState; log: string[] }

const LOG_LINES = 40

function open(game: OpenGame): Table {
  const replayed = replay(game.seed, game.actions)
  if (!replayed.ok) throw new Error('This game could not be replayed. Walk away from it to start another.')
  const opening = game.resumed ? `P03> Welcome back. Turn ${replayed.state.turn}.` : 'P03> A new deal. Draw.'
  return { id: game.id, state: replayed.state, log: [opening] }
}

/** The open game: played here move by move, saved to the server at every bell, and scored there. */
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
          toast.warning('This game moved on in another tab. Picking it up from there.')
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
      const lines = narrate(table.state, outcome.events).map((line) => `P03> ${line}`)
      setTable({ ...table, state: outcome.state, log: [...table.log, ...lines].slice(-LOG_LINES) })
      if (action.type === 'ringBell') void save()
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
  return { status: 'ready', ...table, unsaved, saving, result, act, forfeit }
}
