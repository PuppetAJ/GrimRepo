import { useState } from 'react'
import { debugWanted, downloadRunLog } from './debug.ts'
import type { RunReady } from './useRun.ts'

/** With ?debug, a button over either table that saves the run so far, to replay it exactly. */
export function RunDebug({ run }: { run: RunReady }) {
  const [wanted] = useState(debugWanted)
  if (!wanted || !run.origin) return null
  const origin = run.origin
  return (
    <button
      type="button"
      onClick={() => downloadRunLog(origin, run.history)}
      className="fixed bottom-2 left-2 z-[70] rounded-sm border border-p03-edge bg-black/80 px-2 py-1 font-mono text-xs text-[#7dff9a] hover:bg-[#13261a]"
    >
      Download run log ({run.history.length} moves)
    </button>
  )
}
