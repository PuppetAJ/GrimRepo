import { useNavigate } from '@tanstack/react-router'
import { Flag, Layers, LogOut, Maximize, Menu, Minimize, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { createContext, use, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { STAGES } from 'shared'
import { AlertDialog } from '@/components/ui/alert-dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx'
import FaultyScreenShader from '../../../components/p03/FaultyScreenShader.tsx'
import { ForfeitConfirm } from '../../controls.tsx'
import { useFullScreen } from '../../fullScreen.ts'
import { Panel } from '../../text/Panel.tsx'
import { useFit } from '../../text/sizing.ts'
import type { Layout } from '../../text/useTextTable.ts'
import type { RunReady } from '../useRun.ts'
import { CardSearch, SEARCH_FROM, SearchContext, useCardSearch } from './CardBits.tsx'
import { DeckTable } from './DeckTable.tsx'

export const ICON_BUTTON =
  'relative grid size-10 shrink-0 place-items-center rounded-md border-2 border-p03-edge bg-[#07130b] text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03 aria-expanded:bg-[#13261a] aria-pressed:border-p03 aria-pressed:bg-[#13261a]'

/** Fades a scrolling area's last lines, so it ends softly instead of looking cut off. */
export const FADE = '[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)] pb-10'

type Slots = { actions: HTMLElement | null; bar: HTMLElement | null; deckShown: boolean }
const SlotContext = createContext<Slots>({ actions: null, bar: null, deckShown: false })

/** A screen's own buttons, in the header beside the menu. */
export function ScreenActions({ children }: { children: ReactNode }) {
  const { actions } = use(SlotContext)
  return actions ? createPortal(children, actions) : null
}

/** A screen's own line under the header, above its scrolling content, so it's always in reach. */
export function ScreenBar({ children }: { children: ReactNode }) {
  const { bar } = use(SlotContext)
  return bar ? createPortal(children, bar) : null
}

/** Leaving a screen of cards, in the header beside the menu. */
export function LeaveButton({ label, onLeave }: { label: string; onLeave: () => void }) {
  return (
    <ScreenActions>
      <button
        type="button"
        data-action="leave"
        onClick={onLeave}
        aria-label={label}
        className="flex h-10 shrink-0 items-center rounded-md border-2 border-p03-edge bg-[#07130b] px-3 text-lg text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03"
      >
        Leave
      </button>
    </ScreenActions>
  )
}

/** The search box for a screen of cards, unless the open deck beside it already has the same one. */
export function ScreenSearch({ label, count }: { label: string; count: number }) {
  const { deckShown } = use(SlotContext)
  const { query, setQuery } = useCardSearch()
  return deckShown || count < SEARCH_FROM ? null : <CardSearch query={query} onChange={setQuery} label={label} />
}

const DOCK_KEY = 'grimrepo:run-deck'

function dockedAtFirst(): boolean {
  try {
    return localStorage.getItem(DOCK_KEY) !== 'closed'
  } catch {
    return true
  }
}

function DeckButton({ count, ...props }: { count: number } & ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={`Your deck, ${count} cards`} title="Your deck" className={ICON_BUTTON} {...props}>
      <Layers aria-hidden className="size-5" />
      <span
        aria-hidden
        className="absolute -top-2 -right-2 min-w-5 rounded-full bg-p03 px-1 text-center text-sm leading-5 text-p03-ground"
      >
        {count}
      </span>
    </button>
  )
}

/** On a narrower screen, the deck in a drawer that slides out inside the game's frame, opened from the menu. */
function DeckDrawer({
  run,
  host,
  open,
  onOpenChange,
  returnTo,
}: {
  run: RunReady
  host: HTMLElement | null
  open: boolean
  onOpenChange: (open: boolean) => void
  returnTo: React.RefObject<HTMLButtonElement | null>
}) {
  const count = run.state.deck.length
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {/* Mounted in the frame, so the shade and the drawer cover the game, not the whole window. */}
      <DialogPrimitive.Portal container={host}>
        <DialogPrimitive.Overlay className="absolute inset-0 z-40 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          // Opened from the menu, which closes first, so focus goes back to the menu button.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnTo.current?.focus()
          }}
          className="absolute top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col gap-3 border-l-2 border-p03-edge bg-p03-ground p-4 font-terminal text-xl text-[#b8f5c4] outline-none motion-reduce:animate-none data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
        >
          <div className="flex items-center justify-between gap-2">
            <DialogPrimitive.Title className="text-3xl text-p03">Your deck ({count})</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close the deck" className={ICON_BUTTON}>
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Every card as it stands after this run's changes.
          </DialogPrimitive.Description>
          <div className={`min-h-0 flex-1 overflow-y-auto px-1 ${FADE}`}>
            <DeckTable deck={run.state.deck} caption="Your deck" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function saveWords(run: RunReady): string {
  if (run.id === -1) return 'mockup, never saved'
  return run.saving ? 'saving…' : run.unsaved ? `${run.unsaved} unsaved` : 'saved'
}

/** Everything a screen needn't show all the time: where the run stands, P03's last word, the deck, and the way out. */
function RunMenu({
  run,
  fullScreen,
  onDeck,
  button,
}: {
  run: RunReady
  fullScreen: ReturnType<typeof useFullScreen>
  /** Set where the deck isn't beside the screen, so the menu opens it. */
  onDeck?: () => void
  button: React.RefObject<HTMLButtonElement | null>
}) {
  const { state } = run
  const [abandoning, setAbandoning] = useState(false)
  const navigate = useNavigate()
  const latest = run.news.join(' ')
  const [seen, setSeen] = useState(latest)
  const unread = Boolean(latest) && latest !== seen
  return (
    <>
      {/* Screen readers hear P03 as it speaks; everyone else finds the line in the menu. */}
      <p role="status" className="sr-only">
        {latest ? `P03: ${latest}` : null}
      </p>
      <DropdownMenu onOpenChange={(open) => open && setSeen(latest)}>
        <DropdownMenuTrigger asChild>
          <button
            ref={button}
            type="button"
            aria-label={unread ? 'Run menu, with a new word from P03' : 'Run menu'}
            title="Menu"
            className={ICON_BUTTON}
          >
            <Menu aria-hidden className="size-5" />
            {unread ? <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full bg-[#ffb347]" /> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 border-p03-edge bg-p03-ground font-terminal text-lg">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-lg text-p03">
              Stage {state.stage + 1} of {STAGES.length}: {STAGES[state.stage]}
            </span>
            <span className="block text-base text-p03-dim">
              {state.record.battles} {state.record.battles === 1 ? 'battle' : 'battles'} won · {state.record.bosses}{' '}
              {state.record.bosses === 1 ? 'boss' : 'bosses'} beaten · {saveWords(run)}
            </span>
          </DropdownMenuLabel>
          {latest ? (
            <DropdownMenuLabel className="text-base font-normal text-[#b8f5c4]">P03&gt; {latest}</DropdownMenuLabel>
          ) : null}
          <DropdownMenuSeparator />
          {onDeck ? (
            <DropdownMenuItem onSelect={onDeck} className="text-lg">
              <Layers aria-hidden />
              Your deck ({state.deck.length})
            </DropdownMenuItem>
          ) : null}
          {fullScreen.supported ? (
            <DropdownMenuItem onSelect={fullScreen.toggle} className="text-lg">
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {fullScreen.on ? 'Leave full screen' : 'Full screen'}
            </DropdownMenuItem>
          ) : null}
          {state.status === 'playing' ? (
            <DropdownMenuItem onSelect={() => setAbandoning(true)} className="text-lg">
              <Flag aria-hidden />
              Abandon run
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void navigate({ to: '/' })} className="text-lg">
            <LogOut aria-hidden />
            Leave, saving the run
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={abandoning} onOpenChange={setAbandoning}>
        <ForfeitConfirm forfeit={run.abandon} run />
      </AlertDialog>
    </>
  )
}

/** The frame every screen off the board shares: one header row, the screen, and the deck. */
export function Screen({
  run,
  layout,
  title,
  caption,
  stack = false,
  deck = true,
  children,
}: {
  run: RunReady
  layout: Layout
  title: string
  /** A word above the title, such as what kind of screen it is. */
  caption?: string
  /** On a phone, stacks and centers the header: the title, the screen's line, then its buttons. The map's alone. */
  stack?: boolean
  /** Off for a screen that shows the deck itself. */
  deck?: boolean
  children: ReactNode
}) {
  const { state } = run
  const phone = layout === 'phone'
  const stacked = phone && stack
  // Room enough for the deck beside the screen, so it docks open instead of covering it.
  const roomy = layout === 'wide'
  const [docked, setDocked] = useState(dockedAtFirst)
  const dock = (open: boolean) => {
    setDocked(open)
    try {
      localStorage.setItem(DOCK_KEY, open ? 'open' : 'closed')
    } catch {
      // Storage can be refused in a private window; the choice then lasts until the page closes.
    }
  }
  const showDock = deck && roomy && docked
  const [drawer, setDrawer] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  // One search per screen, cleared when the screen changes.
  const [search, setSearch] = useState({ title, query: '' })
  const query = search.title === title ? search.query : ''
  const fullScreen = useFullScreen({ fallback: phone })
  // The battle table's own size, so moving between the board and these screens never changes the frame.
  const { frame, size } = useFit(fullScreen.on)
  // A layer over the frame for the deck drawer, and the places a screen's own controls go.
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  // The screen's own buttons, the deck and the menu, beside the title or, stacked, under the screen's line.
  const buttonRow = (
    <div className={`flex shrink-0 items-center gap-2 ${stacked ? 'justify-center' : 'ml-auto'}`}>
      <div ref={setActions} className="flex shrink-0 items-center gap-2 empty:hidden" />
      {deck && roomy ? (
        <DeckButton
          count={state.deck.length}
          aria-expanded={docked}
          aria-controls="run-deck"
          onClick={() => dock(!docked)}
        />
      ) : null}
      <RunMenu
        run={run}
        fullScreen={fullScreen}
        onDeck={deck && !roomy ? () => setDrawer(true) : undefined}
        button={menuButton}
      />
    </div>
  )
  const place = phone
    ? fullScreen.on
      ? 'fixed inset-0 z-50 p-3'
      : 'relative h-[calc(100dvh-7rem)] min-h-[30rem] p-3'
    : `rounded-lg border p-4 ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`
  return (
    <SlotContext value={{ actions, bar, deckShown: showDock }}>
      <SearchContext value={{ query, setQuery: (next) => setSearch({ title, query: next }) }}>
        {fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
        <div
          ref={phone ? undefined : frame}
          style={phone ? undefined : size}
          // A table to the keyboard, so a screen's number keys work while focus is anywhere inside it.
          data-table="run"
          tabIndex={-1}
          className={`p03-screen crt flex flex-col gap-3 overflow-hidden border-p03-edge font-terminal text-xl sm:text-2xl ${place}`}
        >
          <FaultyScreenShader />
          <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
          {/* Where the deck drawer opens, covering the frame but taking no clicks until it does. */}
          <div ref={setHost} className="pointer-events-none absolute inset-0 z-40 *:pointer-events-auto" />
          {/* The title wraps rather than being cut off; short of room, the buttons drop to their own line. */}
          <header className="relative z-10 flex shrink-0 flex-wrap items-center gap-2">
            <div className={`min-w-0 flex-1 ${stacked ? 'text-center' : 'basis-48'}`}>
              {caption ? <p className="text-base text-p03-dim">{caption}</p> : null}
              <h2 className="text-3xl leading-tight text-balance [overflow-wrap:anywhere] text-p03">{title}</h2>
            </div>
            {stacked ? null : buttonRow}
          </header>
          {deck && !roomy ? (
            <DeckDrawer run={run} host={host} open={drawer} onOpenChange={setDrawer} returnTo={menuButton} />
          ) : null}
          <div
            className={`relative z-10 grid min-h-0 flex-1 gap-4 ${showDock ? 'grid-cols-[minmax(0,1fr)_20rem]' : ''}`}
          >
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <div ref={setBar} className={`shrink-0 empty:hidden ${stacked ? 'text-center' : ''}`} />
              {stacked ? buttonRow : null}
              {/* Only the content scrolls, inside a frame that stays the same size; padded so focus rings aren't cut. */}
              <div data-scroller className={`min-h-0 flex-1 overflow-y-auto px-1 ${FADE}`}>
                {children}
              </div>
            </div>
            {showDock ? (
              <aside id="run-deck" aria-label="Your deck" className="min-h-0">
                <Panel className="flex h-full min-h-0 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-p03">Your deck ({state.deck.length})</h2>
                    <button
                      type="button"
                      onClick={() => dock(false)}
                      aria-label="Close the deck"
                      className={ICON_BUTTON}
                    >
                      <X aria-hidden className="size-5" />
                    </button>
                  </div>
                  <div className={`min-h-0 flex-1 overflow-y-auto px-1 ${FADE}`}>
                    <DeckTable deck={state.deck} caption="Your deck" />
                  </div>
                </Panel>
              </aside>
            ) : null}
          </div>
        </div>
      </SearchContext>
    </SlotContext>
  )
}
