import { useNavigate } from '@tanstack/react-router'
import {
  Backpack,
  Flag,
  FoldHorizontal,
  LogOut,
  Maximize,
  Menu,
  MessageSquareText,
  Minimize,
  Repeat,
  UnfoldHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { INTEGRITY, STAGES } from 'shared'
import { AlertDialog } from '@/components/ui/alert-dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx'
import { ForfeitConfirm } from './controls.tsx'
import type { useFullScreen } from './fullScreen.ts'
import { useRunNotes } from './run/notes.ts'
import { DebugItem } from './run/RunDebug.tsx'
import type { RunReady } from './run/useRun.ts'
import type { useWideTable } from './wideTable.ts'

/** The menu's way to the other table. */
export type Switch = { label: string; go: () => void }

export function saveWords(run: RunReady): string {
  if (run.id === -1) return 'mockup, never saved'
  return run.saving ? 'saving…' : run.unsaved ? `${run.unsaved} unsaved` : 'saved'
}

/** Everything a table needn't show all the time: where the run stands, P03's last word, the deck, and the way out. */
export function TableMenu({
  run,
  forfeit,
  fullScreen,
  onDeck,
  onSwitch,
  button,
  widen,
  className,
}: {
  /** Left out off a run, where the menu has no run to show, abandon or leave. */
  run?: RunReady
  /** Off a run, forfeits the battle; left out once it can't be. */
  forfeit?: () => Promise<void>
  fullScreen: ReturnType<typeof useFullScreen>
  /** Over the 3D table, its width: the site's, or the window's. */
  widen?: ReturnType<typeof useWideTable>
  /** Set where the deck isn't beside the screen, so the menu opens it. */
  onDeck?: () => void
  onSwitch?: Switch
  button?: React.RefObject<HTMLButtonElement | null>
  /** The menu button's look. */
  className: string
}) {
  const [quitting, setQuitting] = useState(false)
  const navigate = useNavigate()
  const { notes, change } = useRunNotes()
  const latest = run?.news.join(' ') ?? ''
  const [seen, setSeen] = useState(latest)
  const unread = Boolean(latest) && latest !== seen
  const quit = run ? (run.state.status === 'playing' ? run.abandon : undefined) : forfeit
  return (
    <>
      {/* Screen readers hear P03 as it speaks; everyone else finds the line in the menu. */}
      {run ? (
        <p role="status" className="sr-only">
          {latest ? `P03: ${latest}` : null}
        </p>
      ) : null}
      <DropdownMenu onOpenChange={(open) => open && setSeen(latest)}>
        <DropdownMenuTrigger asChild>
          <button
            ref={button}
            type="button"
            aria-label={run ? (unread ? 'Run menu, with a new word from P03' : 'Run menu') : 'Menu'}
            title="Menu"
            className={`relative ${className}`}
          >
            <Menu aria-hidden />
            {unread ? <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full bg-[#ffb347]" /> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 border-p03-edge bg-p03-ground font-terminal text-lg">
          {run ? (
            <>
              <DropdownMenuLabel className="font-normal">
                <span className="block text-lg text-p03">
                  Stage {run.state.stage + 1} of {STAGES.length}: {STAGES[run.state.stage]}
                </span>
                <span className="block text-base text-p03">
                  Integrity {run.state.integrity}/{INTEGRITY}
                </span>
                <span className="block text-base text-p03-dim">
                  {run.state.record.battles} {run.state.record.battles === 1 ? 'battle' : 'battles'} won ·{' '}
                  {run.state.record.bosses} {run.state.record.bosses === 1 ? 'boss' : 'bosses'} beaten ·{' '}
                  {saveWords(run)}
                </span>
              </DropdownMenuLabel>
              {latest ? (
                <DropdownMenuLabel className="text-base font-normal text-[#b8f5c4]">P03&gt; {latest}</DropdownMenuLabel>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {onDeck ? (
            <DropdownMenuItem onSelect={onDeck} className="text-lg">
              <Backpack aria-hidden />
              Inventory
            </DropdownMenuItem>
          ) : null}
          {fullScreen.supported ? (
            <DropdownMenuItem onSelect={fullScreen.toggle} className="text-lg">
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {fullScreen.on ? 'Leave full screen' : 'Full screen'}
            </DropdownMenuItem>
          ) : null}
          {widen?.offered && !fullScreen.on ? (
            <DropdownMenuItem onSelect={widen.toggle} className="text-lg">
              {widen.wide ? <FoldHorizontal aria-hidden /> : <UnfoldHorizontal aria-hidden />}
              {widen.wide ? 'Narrow the table' : 'Widen the table'}
            </DropdownMenuItem>
          ) : null}
          {onSwitch ? (
            <DropdownMenuItem onSelect={onSwitch.go} className="text-lg">
              <Repeat aria-hidden />
              {onSwitch.label}
            </DropdownMenuItem>
          ) : null}
          {run && notes ? (
            <DropdownMenuCheckboxItem
              checked={!notes.off}
              onCheckedChange={(on) => change({ off: !on })}
              // Kept open, so the tick shows the change.
              onSelect={(event) => event.preventDefault()}
              className="text-lg"
            >
              <MessageSquareText aria-hidden />
              P03's run notes
            </DropdownMenuCheckboxItem>
          ) : null}
          {quit ? (
            <DropdownMenuItem onSelect={() => setQuitting(true)} className="text-lg">
              <Flag aria-hidden />
              {run ? 'Abandon run' : 'Forfeit'}
            </DropdownMenuItem>
          ) : null}
          {run ? (
            <>
              <DebugItem />
              <DropdownMenuItem onSelect={() => void navigate({ to: '/' })} className="text-lg">
                <LogOut aria-hidden />
                Leave, saving the run
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {quit ? (
        <AlertDialog open={quitting} onOpenChange={setQuitting}>
          <ForfeitConfirm forfeit={quit} run={Boolean(run)} />
        </AlertDialog>
      ) : null}
    </>
  )
}
