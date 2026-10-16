import { RUN_RULES_VERSION, type RunAction } from 'shared'

/** What a run was dealt from, which with its moves replays it exactly. */
export type RunOrigin = { seed: number; death: string | null; rival: { card: string; by: string } | null }

/** On with ?debug, off with ?debug=0, and remembered for the browser session in between. */
export function debugWanted(): boolean {
  const asked = new URLSearchParams(window.location.search).get('debug')
  try {
    if (asked !== null) sessionStorage.setItem('grimrepo:debug', asked === '0' ? '0' : '1')
    return sessionStorage.getItem('grimrepo:debug') === '1'
  } catch {
    return asked !== null && asked !== '0'
  }
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
