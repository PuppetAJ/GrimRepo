import { Layers } from 'lucide-react'
import type { ReactNode } from 'react'
import { STAGES } from 'shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.tsx'
import FaultyScreenShader from '../../../components/p03/FaultyScreenShader.tsx'
import { Forfeit } from '../../controls.tsx'
import { useFit } from '../../text/sizing.ts'
import { Panel, SIDE_BUTTON } from '../../text/Panel.tsx'
import type { Layout } from '../../text/useTextTable.ts'
import type { RunReady } from '../useRun.ts'
import { DeckTable } from './DeckTable.tsx'

function DeckButton({ run }: { run: RunReady }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={`${SIDE_BUTTON} flex items-center gap-2`}>
          <Layers aria-hidden className="size-5" />
          Deck ({run.state.deck.length})
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-p03-edge bg-p03-ground font-terminal text-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-terminal text-3xl font-normal text-p03">Your deck</DialogTitle>
          <DialogDescription>{run.state.deck.length} cards, as they stand after this run's changes.</DialogDescription>
        </DialogHeader>
        <DeckTable deck={run.state.deck} caption="Your deck" />
      </DialogContent>
    </Dialog>
  )
}

function SaveStatus({ run }: { run: RunReady }) {
  if (run.id === -1) return <span>mockup, never saved</span>
  return <span>{run.saving ? 'saving…' : run.unsaved ? `${run.unsaved} unsaved` : 'saved'}</span>
}

/** The frame every screen off the board shares: where the run stands, P03's last word, and the deck. */
export function Screen({
  run,
  layout,
  title,
  deck = true,
  children,
}: {
  run: RunReady
  layout: Layout
  title: string
  /** Off for a screen that shows the deck itself. */
  deck?: boolean
  children: ReactNode
}) {
  const { state } = run
  const phone = layout === 'phone'
  const wide = layout === 'wide' && deck
  // The battle table's own size, so moving between the board and these screens never changes the frame.
  const { frame, size } = useFit(false)
  return (
    <div
      ref={phone ? undefined : frame}
      style={phone ? undefined : size}
      className={`p03-screen crt relative mx-auto flex flex-col gap-3 overflow-hidden border-p03-edge font-terminal text-xl sm:text-2xl ${phone ? 'h-[calc(100dvh-7rem)] min-h-[30rem] p-3' : 'rounded-lg border p-4'}`}
    >
      <FaultyScreenShader />
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <p className="text-p03">
            Stage {state.stage + 1} of {STAGES.length}: {STAGES[state.stage]}
          </p>
          <p className="text-lg text-p03-dim">
            {state.record.battles} {state.record.battles === 1 ? 'battle' : 'battles'} won · {state.record.bosses}{' '}
            {state.record.bosses === 1 ? 'boss' : 'bosses'} beaten · <SaveStatus run={run} />
          </p>
        </div>
        <div className="flex items-center gap-2 text-lg">
          {wide || !deck ? null : <DeckButton run={run} />}
          {state.status === 'playing' ? (
            <Forfeit forfeit={run.abandon} run className={`${SIDE_BUTTON} h-auto`} />
          ) : null}
        </div>
        {/* Polite, so P03's word on a burned or changed card is read after the screen that follows. */}
        <p role="status" className="basis-full text-p03-dim">
          {run.news.length ? `P03> ${run.news.join(' ')}` : null}
        </p>
      </header>
      {/* Only the content scrolls, inside a frame that stays the same size. */}
      <div className={`relative z-10 grid min-h-0 flex-1 gap-4 ${wide ? 'grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <h2 className="shrink-0 text-3xl text-p03">{title}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        </div>
        {wide ? (
          // Focusable, so a long deck can be scrolled from the keyboard.
          <aside
            aria-label="Your deck"
            tabIndex={0}
            className="min-h-0 overflow-y-auto rounded-md focus-visible:outline-2 focus-visible:outline-p03"
          >
            <Panel className="flex min-h-full flex-col gap-3">
              <h2 className="text-p03">Your deck ({state.deck.length})</h2>
              <DeckTable deck={state.deck} caption="Your deck" />
            </Panel>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
