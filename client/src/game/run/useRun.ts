import { useCallback, useEffect, useRef, useState } from 'react'
import { applyRun, createRun, encounter, RUN_SAVE_LIMIT, type RunAction, type RunEvent, type RunState } from 'shared'
import { toast } from 'sonner'
import { api, ApiError, type OpenRun, type RunOver } from '../../lib/api.ts'
import { narrate, opening } from '../../lib/narrate.ts'
import type { Mockup } from './mockups.ts'
import { narrateRun } from './narrate.ts'

type Listener = (events: RunEvent[]) => void

/** An event just decided: the scene, the choice, and what it did, kept on screen until the player moves on. */
export type Aftermath = { event: string; option: number; lines: string[] }

export type Run =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      id: number
      /** Counts every start and reload, so a screen can tell a fresh run from a move. */
      generation: number
      /** Every action taken, saved or not. */
      moves: number
      state: RunState
      /** P03's console for the battle in progress, or the last one. */
      log: string[]
      /** What the last action did to the deck or the run, in P03's words. */
      news: string[]
      /** The nodes entered on this stage's map, in order. */
      path: string[]
      aftermath: Aftermath | null
      /** Closes the aftermath, back to the map. */
      dismiss: () => void
      unsaved: number
      saving: boolean
      /** The server's verdict, once the run has ended and been saved. */
      over: RunOver | null
      act: (action: RunAction) => void
      abandon: () => Promise<void>
      /** Starts the next run once this one is over. */
      again: () => void
      subscribe: (listener: Listener) => () => void
    }

export type RunReady = Extract<Run, { status: 'ready' }>

type Table = {
  id: number
  generation: number
  moves: number
  state: RunState
  log: string[]
  news: string[]
  path: string[]
  aftermath: Aftermath | null
}

const LOG_LINES = 2_000
const p03 = (lines: string[]) => lines.map((line) => `P03> ${line}`)

let generations = 0

/** The battle console after an action: fresh when a battle starts, else the battle's lines added. */
function logAfter(log: string[], before: RunState, after: RunState, events: RunEvent[]): string[] {
  const entered = events.find((event) => event.type === 'entered')
  if (entered && after.visit?.kind === 'battle') {
    const [, ...queued] = opening(after.visit.game)
    const id = after.visit.game.opponent.encounter
    const fight = id ? encounter(id) : null
    const first = !fight
      ? 'Another battle. Draw.'
      : fight.boss
        ? `${fight.name}. ${fight.intro} ${fight.phases.length} phases. Try to keep up. Draw.`
        : `${fight.name}. ${fight.intro} Draw.`
    return p03([first, ...queued])
  }
  const game = before.visit?.kind === 'battle' ? before.visit.game : null
  if (!game) return log
  const lines = events.flatMap((event) => (event.type === 'battle' ? narrate(game, event.events) : []))
  return lines.length ? [...log, ...p03(lines)].slice(-LOG_LINES) : log
}

type Story = Pick<Table, 'state' | 'log' | 'news' | 'path'>

function told(story: Story, after: RunState, events: RunEvent[]): Story {
  const entered = events.flatMap((event) => (event.type === 'entered' ? [event.node] : []))
  return {
    state: after,
    log: logAfter(story.log, story.state, after, events),
    news: narrateRun(story.state, events),
    path: after.stage === story.state.stage ? [...story.path, ...entered] : entered,
  }
}

function open(run: OpenRun): Table {
  let story: Story = { state: createRun({ seed: run.seed }), log: [], news: [], path: [] }
  for (const action of run.actions) {
    const result = applyRun(story.state, action)
    if (!result.ok) throw new Error('This run could not be replayed. Abandon it to start another.')
    story = told(story, result.state, result.events)
  }
  generations += 1
  return { id: run.id, generation: generations, moves: run.actions.length, aftermath: null, ...story }
}

/** Plays the open run locally and saves it at every step off the board, and at every draw and bell on it; a mockup is never saved. */
export function useRun(mockup: Mockup | null = null): Run {
  const [table, setTable] = useState<Table | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const [unsaved, setUnsaved] = useState(0)
  const [saving, setSaving] = useState(false)
  const [over, setOver] = useState<RunOver | null>(null)
  // Refs, so a queued save reads them when it runs, not when it was queued.
  const saved = useRef(0)
  const pending = useRef<RunAction[]>([])
  const chain = useRef<Promise<void>>(Promise.resolve())
  const listeners = useRef(new Set<Listener>())
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => void listeners.current.delete(listener)
  }, [])

  useEffect(() => {
    // Deferred like a server reply, so a mockup loads the same way a run does.
    if (mockup)
      return void Promise.resolve().then(() => {
        generations += 1
        setTable({
          id: -1,
          generation: generations,
          moves: 0,
          state: mockup.state,
          log: ['P03> A mockup: played here and never saved.'],
          news: mockup.news ?? [],
          path: mockup.path,
          aftermath: null,
        })
        setOver(mockup.over ?? null)
      })
    let current = true
    api.startRun().then(
      (run) => {
        if (!current) return
        try {
          saved.current = run.actions.length
          pending.current = []
          setTable(open(run))
          setUnsaved(0)
          setOver(null)
          setError(null)
          if (run.rulesChanged) toast.warning('The rules changed since your last run began, so a new one starts.')
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      },
      (failure: unknown) => current && setError(failure instanceof Error ? failure.message : String(failure)),
    )
    return () => {
      current = false
    }
  }, [reloads, mockup])

  const id = table?.id
  // Failed saves retry with backoff until they land, since the last action of a run has none after it.
  const retry = useRef<{ timer?: ReturnType<typeof setTimeout>; wait: number }>({ wait: 0 })
  const again = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => () => clearTimeout(retry.current.timer), [])

  // Saves are chained so they never overlap, and sent in batches the server accepts.
  const save = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      clearTimeout(retry.current.timer)
      while (id !== undefined && id !== -1 && pending.current.length) {
        const batch = pending.current.slice(0, RUN_SAVE_LIMIT)
        setSaving(true)
        try {
          const reply = await api.saveRunMoves(id, saved.current, batch)
          saved.current += batch.length
          pending.current = pending.current.slice(batch.length)
          retry.current.wait = 0
          if (reply.status !== 'playing') setOver(reply)
        } catch (failure) {
          // Out of step with the server, usually from another tab; the server's copy wins.
          if (failure instanceof ApiError && failure.status === 409) {
            toast.warning(
              failure.body['rulesChanged']
                ? "The rules changed since this run began, so it can't continue. Starting a new one."
                : 'This run moved on in another tab. Picking it up from there.',
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
          break
        } finally {
          setSaving(false)
          setUnsaved(pending.current.length)
        }
      }
    })
    return chain.current
  }, [id])
  useEffect(() => {
    again.current = save
  }, [save])

  const act = useCallback(
    (action: RunAction) => {
      if (!table) return
      const outcome = applyRun(table.state, action)
      if (!outcome.ok) {
        toast.error(outcome.reason)
        return
      }
      if (table.id !== -1) pending.current.push(action)
      setUnsaved(pending.current.length)
      for (const listener of listeners.current) listener(outcome.events)
      const story = told(table, outcome.state, outcome.events)
      const visit = table.state.visit
      const aftermath =
        action.type === 'choose' && visit?.kind === 'event'
          ? { event: visit.event, option: action.option, lines: story.news }
          : null
      setTable({ ...table, moves: table.moves + 1, ...story, aftermath })
      // On the board, saves wait for a draw or the bell, as a quick battle's do, or a reload could peek at a draw.
      const quiet = action.type === 'play' && action.action.type !== 'draw' && action.action.type !== 'ringBell'
      if (!quiet || outcome.state.status !== 'playing') void save()
    },
    [table, save],
  )

  const playing = table?.state.status === 'playing'
  const abandon = useCallback(async () => {
    if (id === undefined || !playing) return
    if (id === -1) return setReloads((n) => n + 1)
    try {
      // Unsaved moves are dropped; the run ends where the server last saw it.
      await chain.current
      setOver(await api.forfeitRun(id))
      setTable((current) => current && { ...current, state: { ...current.state, status: 'lost' } })
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    }
  }, [id, playing])

  const next = useCallback(() => setReloads((n) => n + 1), [])
  const dismiss = useCallback(() => setTable((now) => now && { ...now, aftermath: null }), [])

  if (error) return { status: 'error', message: error }
  if (!table) return { status: 'loading' }
  return { status: 'ready', ...table, unsaved, saving, over, act, abandon, again: next, dismiss, subscribe }
}
