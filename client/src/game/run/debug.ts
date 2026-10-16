import { useSyncExternalStore } from 'react'
import { RUN_RULES_VERSION, type RunAction } from 'shared'

/** What a run was dealt from, which with its moves replays it exactly. */
export type RunOrigin = { seed: number; death: string | null; rival: { card: string; by: string } | null }

const KEY = 'grimrepo:debug'
const listeners = new Set<() => void>()

/** On with ?debug or the run menu, off with ?debug=0 or the menu again, and remembered for the browser session. */
function read(): boolean {
  const asked = new URLSearchParams(window.location.search).get('debug')
  try {
    if (asked !== null) sessionStorage.setItem(KEY, asked === '0' ? '0' : '1')
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return asked !== null && asked !== '0'
  }
}

let on = typeof window !== 'undefined' && read()

export const debugging = (): boolean => on

export function setDebugging(next: boolean): void {
  on = next
  try {
    sessionStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // Private windows may refuse; it then lasts only as long as the page.
  }
  for (const listener of listeners) listener()
}

export function useDebugging(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, debugging)
}

/** Saves the run's origin and every move as a JSON file, for replaying it with docs/tools/replay-run.ts. */
export function downloadRunLog(origin: RunOrigin, actions: RunAction[]): void {
  const log = { rules: RUN_RULES_VERSION, ...origin, actions, savedAt: new Date().toISOString() }
  const url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 1)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `grimrepo-run-${origin.seed}-move-${actions.length}.json`
  link.click()
  URL.revokeObjectURL(url)
}
