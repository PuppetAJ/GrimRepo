import { lazy, Suspense } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx'
import { useTable } from './context.ts'
import { PromptLine } from './Reading.tsx'
import { useStuckToBottom } from './sizing.ts'

const Terminal = lazy(() => import('../../components/p03/Terminal.tsx'))
const TERMINAL_LINES = ['Lost already? Type help.', 'Or tutorial, if you need it spelled out.']

function LogItems() {
  const { game } = useTable()
  return game.log.map((line, index) => (
    <li key={index} className="first:mt-auto">
      {line}
    </li>
  ))
}

// A log is announced as it grows, and focusable so a keyboard can scroll it; `log` isn't allowed on a list itself.
const LOG = { role: 'log', 'aria-label': "P03's console", tabIndex: 0 } as const

export function ConsolePanel() {
  const { game } = useTable()
  const [box, onScroll] = useStuckToBottom(game.log.length)
  return (
    <div className="flex min-h-16 flex-1 basis-0 flex-col rounded-md border-2 border-p03-edge bg-[#07130b] p-2 text-base">
      <div ref={box} onScroll={onScroll} {...LOG} className="flex min-h-0 flex-1 flex-col overflow-y-auto text-lg">
        <ol className="mt-auto">
          <LogItems />
        </ol>
      </div>
    </div>
  )
}

/** `log` is the log's display classes; a short phone shows only the prompt, the log still read out. */
export function LogBox({ className, log = '' }: { className: string; log?: string }) {
  const { game, promptText } = useTable()
  const [box, onScroll] = useStuckToBottom(`${game.log.length} ${promptText}`)
  return (
    <div
      ref={box}
      onScroll={onScroll}
      {...LOG}
      className={`@container flex flex-col gap-1 overflow-y-auto rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 p-2 ${className}`}
    >
      <ol className={`mt-auto text-base leading-tight text-p03-dim ${log}`}>
        <LogItems />
      </ol>
      <PromptLine />
    </div>
  )
}

export function LogDialog() {
  const { game, logOpen, setLogOpen } = useTable()
  const [box, onScroll] = useStuckToBottom(game.log.length)
  return (
    <Dialog open={logOpen} onOpenChange={setLogOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[85dvh] flex-col border-2 border-p03-edge bg-[#07130b] font-terminal text-p03 ring-0"
      >
        <DialogHeader>
          <DialogTitle className="font-terminal text-2xl font-normal text-p03">Battle log</DialogTitle>
        </DialogHeader>
        <ol ref={box} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto text-lg">
          <LogItems />
        </ol>
      </DialogContent>
    </Dialog>
  )
}

export function TerminalDialog() {
  const { terminalOpen, setTerminalOpen, user } = useTable()
  return (
    <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(32rem,85dvh)] flex-col overflow-hidden border-2 border-p03-edge bg-p03-ground p-0 ring-0 [&>[data-slot=dialog-close]]:z-10"
      >
        <DialogTitle className="sr-only">P03's terminal</DialogTitle>
        <Suspense fallback={<div className="h-full bg-p03-ground" />}>
          <Terminal lines={TERMINAL_LINES} user={user} />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
