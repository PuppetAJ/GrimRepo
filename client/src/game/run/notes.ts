import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { findNode, isRunNote, type GameState, type RunNote, type RunState } from 'shared'
import { api, type Notes, type NotesChange } from '../../lib/api.ts'
import { authClient, DEMO } from '../../lib/auth.ts'
import type { RunView } from './runView.ts'

// Everyone shares the demo account, so its notes are kept in the browser, as is a visitor's before they have an account.
const LOCAL_KEY = 'grimrepo:run-notes'

type Store = {
  /** Whose notes are loaded: a player's id, or 'local'. */
  owner: string | null
  notes: Notes | null
  /** The note each place on screen has taken, so it stays put once seen; null once closed. */
  held: Map<string, RunNote | null>
}

let store: Store = { owner: null, notes: null, held: new Map() }
const listeners = new Set<() => void>()

function set(next: Partial<Store>) {
  store = { ...store, ...next }
  for (const listener of listeners) listener()
}

function readLocal(): Notes {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Partial<Notes>
    return { seen: (saved.seen ?? []).filter(isRunNote), off: saved.off === true }
  } catch {
    return { seen: [], off: false }
  }
}

function writeLocal(notes: Notes) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes))
  } catch {
    // A private window can refuse storage; the notes then come back next visit.
  }
}

function load(owner: string) {
  if (store.owner === owner) return
  set({ owner, notes: null, held: new Map() })
  if (owner === 'local') return set({ notes: readLocal() })
  // A player whose notes can't be read sees none, rather than every one again.
  api
    .notes()
    .then((notes) => store.owner === owner && set({ notes }))
    .catch(() => {})
}

function applied(notes: Notes, change: NotesChange): Notes {
  const kept = change.reset ? [] : notes.seen
  return { seen: [...new Set([...kept, ...(change.seen ?? [])])], off: change.off ?? notes.off }
}

/** Changes the notes at once; the server's answer replaces them when it comes. */
function change(owner: string, update: NotesChange) {
  if (store.owner !== owner || !store.notes) return
  const notes = applied(store.notes, update)
  set({ notes })
  if (owner === 'local') return writeLocal(notes)
  api
    .changeNotes(update)
    .then((saved) => store.owner === owner && set({ notes: saved }))
    .catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The player's notes, null while they load, and a way to change them. */
export function useRunNotes() {
  const user = authClient.useSession().data?.user as { id: string; username?: string } | undefined
  const owner = !user || user.username === DEMO.username ? 'local' : user.id
  useEffect(() => load(owner), [owner])
  const current = useSyncExternalStore(subscribe, () => store)
  const update = useCallback((next: NotesChange) => change(owner, next), [owner])
  return { notes: current.owner === owner ? current.notes : null, change: update }
}

/** The notes a screen could show, first to last; a battle's depend on where it is and how it's going. */
function wanted(view: RunView, state: RunState, game: GameState | null, every = false): RunNote[] {
  if (view === 'battle') {
    if (!game) return []
    const boss = state.at !== null && findNode(state.map, state.at)?.kind === 'boss'
    return [
      'battle',
      ...(boss ? (['boss'] as const) : []),
      ...(every || (game.catchUp && game.drawn) ? (['catchUp'] as const) : []),
    ]
  }
  return isRunNote(view) ? [view] : []
}

export type ShownNote = { id: RunNote; close: () => void }

/**
 * The note for the screen on show, if the player hasn't seen it. It's counted as seen as soon as it shows, and stays
 * until closed or the screen changes; a battle's place changes each turn, so the next note waits for the next turn.
 */
export function useRunNote(
  run: { generation: number; origin: unknown; state: RunState; note?: RunNote | null },
  view: RunView,
  game: GameState | null = null,
): ShownNote | null {
  const { notes, change: update } = useRunNotes()
  const { state } = run
  const place = `${run.generation}:${state.stage}:${state.at}:${view}${game ? `:${game.turn}` : ''}`
  // A mockup has no origin, and shows no notes.
  const next =
    run.origin && notes && !notes.off && state.status === 'playing'
      ? (wanted(view, state, game).find((id) => !notes.seen.includes(id)) ?? null)
      : null
  useEffect(() => {
    if (!next || store.held.has(place)) return
    store.held.set(place, next)
    update({ seen: [next] })
  }, [next, place, update])
  const stored = useSyncExternalStore(subscribe, () => store.held.get(place) ?? null)
  // A mockup's own note shows on its screen until closed, and is never stored.
  const [closed, setClosed] = useState<string | null>(null)
  const mocked =
    run.note && wanted(view, state, game, true).includes(run.note) && closed !== `${place}:${run.note}`
      ? run.note
      : null
  const held = run.origin ? stored : mocked
  const off = run.origin ? (notes?.off ?? false) : false
  return useMemo(
    () =>
      held && !off
        ? {
            id: held,
            close: () => {
              if (!run.origin) return setClosed(`${place}:${held}`)
              store.held.set(place, null)
              set({})
            },
          }
        : null,
    [held, off, place, run.origin],
  )
}
