import { Bug } from 'lucide-react'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu.tsx'
import { downloadRunLog, setDebugging, useDebugging } from './debug.ts'
import type { RunReady } from './useRun.ts'

export function RunDebug({ run }: { run: RunReady }) {
  const wanted = useDebugging()
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

export function DebugItem() {
  const on = useDebugging()
  return (
    <DropdownMenuCheckboxItem
      checked={on}
      onCheckedChange={setDebugging}
      onSelect={(event) => event.preventDefault()}
      className="text-lg"
    >
      <Bug aria-hidden />
      Debug log
    </DropdownMenuCheckboxItem>
  )
}
