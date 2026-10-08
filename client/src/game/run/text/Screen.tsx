import { useNavigate } from '@tanstack/react-router'
import { Backpack, Flag, LogOut, Maximize, Menu, Minimize, Repeat, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { use, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
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
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { ForfeitConfirm } from '../../controls.tsx'
import { useFullScreen } from '../../fullScreen.ts'
import { Panel } from '../../text/Panel.tsx'
import { useFit } from '../../text/sizing.ts'
import type { Layout } from '../../text/useTextTable.ts'
import type { RunReady } from '../useRun.ts'
import { SearchContext } from './CardBits.tsx'
import { DeckTable } from './DeckTable.tsx'
import { HeldTools } from './HeldTools.tsx'
import { SlotContext, type Mode } from './slots.ts'

export const ICON_BUTTON =
  'relative grid size-10 shrink-0 place-items-center rounded-md border-2 border-p03-edge bg-[#07130b] text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03 aria-expanded:bg-[#13261a] aria-pressed:border-p03 aria-pressed:bg-[#13261a]'

/** The map's page size in the projector's window, in the window's proportions. */
const WINDOW_PX = { width: 840, height: 540 }

/** Fades a scrolling area's last lines, so it ends softly instead of looking cut off. */
export const FADE = '[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)] pb-10'

export { useScreenMode } from './slots.ts'

/** A screen in the projector's light: it flickers now and then, faintly and at random, so it stays easy to read. */
function Hologram({ fading, children }: { fading: boolean; children: ReactNode }) {
  const light = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let timer: ReturnType<typeof setTimeout>
    const flicker = () => {
      const element = light.current
      if (!element) return
      const dip = Math.random() < 0.15
      element.style.opacity = String(dip ? 0.82 + Math.random() * 0.08 : 0.96 + Math.random() * 0.04)
      // A dip lasts a few frames; the steady glow, a random while.
      timer = setTimeout(flicker, dip ? 40 + Math.random() * 80 : 1200 + Math.random() * 4000)
    }
    flicker()
    return () => clearTimeout(timer)
  }, [])
  return (
    <div ref={light} className="hologram">
      {/* Fades in as a screen takes the window, and out before the next one does. */}
      <m.div
        inert={fading}
        initial={{ opacity: 0 }}
        animate={{ opacity: fading ? 0 : 1 }}
        transition={{ duration: fading ? 0.15 : 0.2 }}
        className="hologram-glow"
      >
        {children}
      </m.div>
    </div>
  )
}

/** A screen's own buttons, in the header beside the menu. */
export function ScreenActions({ children }: { children: ReactNode }) {
  const { actions } = use(SlotContext)
  return actions ? createPortal(children, actions) : null
}

/** Something of the screen's in the middle of the header, where there's room for it; shown only on wide screens. */
export function ScreenCenter({ children }: { children: ReactNode }) {
  const { center } = use(SlotContext)
  return center ? createPortal(children, center) : null
}

/** A screen's own line under the header, above its scrolling content, so it's always in reach. */
export function ScreenBar({ children }: { children: ReactNode }) {
  const { bar } = use(SlotContext)
  return bar ? createPortal(children, bar) : null
}

/** A worded button in the header, beside the menu. */
export const HEADER_BUTTON =
  'flex h-10 shrink-0 items-center rounded-md border-2 border-p03-edge bg-[#07130b] px-3 text-lg text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03'

/** Leaving a screen of cards, in the header beside the menu. */
export function LeaveButton({ label, onLeave }: { label: string; onLeave: () => void }) {
  return (
    <ScreenActions>
      <button type="button" data-action="leave" onClick={onLeave} aria-label={label} className={HEADER_BUTTON}>
        Leave
      </button>
    </ScreenActions>
  )
}

const DOCK_KEY = 'grimrepo:run-deck'

function dockedAtFirst(): boolean {
  try {
    return localStorage.getItem(DOCK_KEY) !== 'closed'
  } catch {
    return true
  }
}

/** Opens the inventory: the deck and the tools carried. */
function InventoryButton({ count, tools, ...props }: { count: number; tools: number } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={`Your inventory, ${count} cards and ${tools} ${tools === 1 ? 'tool' : 'tools'}`}
      title="Inventory"
      className={ICON_BUTTON}
      {...props}
    >
      <Backpack aria-hidden className="size-5" />
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
            <DialogPrimitive.Title className="text-3xl text-p03">Inventory</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close the inventory" className={ICON_BUTTON}>
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            The tools carried, and every card as it stands after this run's changes.
          </DialogPrimitive.Description>
          <HeldTools items={run.state.items} label="Tools" />
          <h3 className="text-p03">Deck ({count})</h3>
          <div className={`min-h-0 flex-1 overflow-y-auto px-1 ${FADE}`}>
            <DeckTable deck={run.state.deck} caption="Your deck" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The menu's way to the other table. */
export type Switch = { label: string; go: () => void }

export function saveWords(run: RunReady): string {
  if (run.id === -1) return 'mockup, never saved'
  return run.saving ? 'saving…' : run.unsaved ? `${run.unsaved} unsaved` : 'saved'
}

/** Everything a screen needn't show all the time: where the run stands, P03's last word, the deck, and the way out. */
function RunMenu({
  run,
  fullScreen,
  onDeck,
  onSwitch,
  button,
}: {
  run: RunReady
  fullScreen: ReturnType<typeof useFullScreen>
  /** Set where the deck isn't beside the screen, so the menu opens it. */
  onDeck?: () => void
  onSwitch?: Switch
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
          {onSwitch ? (
            <DropdownMenuItem onSelect={onSwitch.go} className="text-lg">
              <Repeat aria-hidden />
              {onSwitch.label}
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
  mode = 'terminal',
  onSwitch,
  pinTo,
  fading = false,
  waiting = false,
  children,
}: {
  /** Fades the projected content out, before the next screen takes the window. */
  fading?: boolean
  /** Over the 3D table, while the projector is still opening: the screen holds back its content, so its entrances play once seen. */
  waiting?: boolean
  run: RunReady
  layout: Layout
  title: string
  /** A word above the title, such as what kind of screen it is. */
  caption?: string
  /** On a phone, stacks and centers the header: the title, the screen's line, then its buttons. The map's alone. */
  stack?: boolean
  /** Off for a screen that shows the deck itself. */
  deck?: boolean
  /** The text table's terminal; over the 3D table, a floating panel, or the map as a hologram above the board. */
  mode?: Mode
  onSwitch?: Switch
  /** The hologram's page element, which the 3D scene pins onto the projector's window. */
  pinTo?: React.RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const { state } = run
  const terminal = mode === 'terminal'
  const phone = layout === 'phone'
  const stacked = phone && stack
  // Room enough for the deck beside the screen, so it docks open instead of covering it.
  // Over the hologram the deck is a drawer, so the room stays in view.
  const roomy = layout === 'wide' && mode !== 'hologram'
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
  const still = useReducedMotion()
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
  const [center, setCenter] = useState<HTMLDivElement | null>(null)
  // Between the title and the buttons, on screens wide enough to keep all three on one line.
  // Its top level with the title's and the menu's; taller than they are, it hangs down beside the screen's line rather than
  // making the header taller.
  const centerSlot = (
    <div
      ref={setCenter}
      data-center-slot
      className="absolute top-0 left-1/2 hidden -translate-x-1/2 empty:hidden xl:flex"
    />
  )
  // The screen's own buttons, the deck and the menu, beside the title or, stacked, under the screen's line.
  const menu = (
    <RunMenu
      run={run}
      fullScreen={fullScreen}
      onDeck={deck && !roomy ? () => setDrawer(true) : undefined}
      onSwitch={onSwitch}
      button={menuButton}
    />
  )
  // Stacked, the menu keeps to the top right corner, so it has room, and the screen's own buttons sit centered below.
  const buttonRow = (
    <div className={`flex shrink-0 items-center gap-2 ${stacked ? 'justify-center' : 'ml-auto'}`}>
      <div ref={setActions} className="flex shrink-0 items-center gap-2 empty:hidden" />
      {deck && roomy ? (
        <InventoryButton
          count={state.deck.length}
          tools={state.items.length}
          aria-expanded={docked}
          aria-controls="run-deck"
          onClick={() => dock(!docked)}
        />
      ) : null}
      {stacked ? null : menu}
    </div>
  )
  const drawerHost = <div ref={setHost} className="pointer-events-none absolute inset-0 z-40 *:pointer-events-auto" />
  const deckDrawer =
    deck && !roomy ? (
      <DeckDrawer run={run} host={host} open={drawer} onOpenChange={setDrawer} returnTo={menuButton} />
    ) : null

  // Over the 3D table, everything goes in the projector's window, which the scene warps onto it every frame.
  if (mode === 'hologram')
    return (
      <SlotContext value={{ actions, bar, center, mode }}>
        <SearchContext value={{ query, setQuery: (next) => setSearch({ title, query: next }) }}>
          <div
            data-table="run"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden font-terminal text-xl text-[#b8f5c4]"
          >
            <div
              ref={pinTo}
              className="hologram-window pointer-events-auto absolute top-0 left-0 origin-top-left"
              style={{ width: WINDOW_PX.width, height: WINDOW_PX.height }}
            >
              <Hologram fading={fading}>
                <header className="relative flex shrink-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {caption ? <p className="text-base text-p03-dim">{caption}</p> : null}
                    <h2 className="text-2xl leading-tight text-balance [overflow-wrap:anywhere] text-p03">{title}</h2>
                  </div>
                  {buttonRow}
                </header>
                <div ref={setBar} className="shrink-0 empty:hidden" />
                {/* Only the content scrolls; a screen marked data-center, such as a card choice, sits in the middle. */}
                <div data-scroller className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
                  <div className="has-[[data-center]]:my-auto">{waiting ? null : children}</div>
                </div>
              </Hologram>
            </div>
            {drawerHost}
            {deckDrawer}
          </div>
        </SearchContext>
      </SlotContext>
    )
  // Over the 3D table, the scene behind is the frame, and its page decides full screen.
  const place =
    mode === 'floating'
      ? `absolute z-10 bg-p03-ground/60 backdrop-blur-[3px] ${phone ? 'inset-0 p-3' : 'inset-x-3 inset-y-3 mx-auto max-w-6xl rounded-lg border p-4'}`
      : phone
        ? fullScreen.on
          ? 'fixed inset-0 z-50 p-3'
          : 'relative h-[calc(100dvh-7rem)] min-h-[30rem] p-3'
        : `rounded-lg border p-4 ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`
  return (
    <SlotContext value={{ actions, bar, center, mode }}>
      <SearchContext value={{ query, setQuery: (next) => setSearch({ title, query: next }) }}>
        {terminal && fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
        {/* Floating over the 3D table, it rises into place as it opens. */}
        <m.div
          ref={phone || !terminal ? undefined : frame}
          style={phone || !terminal ? undefined : size}
          initial={mode === 'floating' ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          // A table to the keyboard, so a screen's number keys work while focus is anywhere inside it.
          data-table="run"
          tabIndex={-1}
          className={`p03-screen crt flex flex-col gap-3 overflow-hidden border-p03-edge font-terminal text-xl sm:text-2xl ${place}`}
        >
          {/* The terminal's glyphs, also when a screen floats over the 3D table in place of the projector. */}
          <FaultyScreenShader />
          <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
          {/* Where the deck drawer opens, covering the frame but taking no clicks until it does. */}
          {drawerHost}
          {/* The title wraps beside the buttons rather than pushing them to a line of their own, down to 320px. */}
          <header className="relative z-10 flex shrink-0 items-center gap-2">
            {/* Stacked, the title stays clear of the menu in the corner. */}
            {/* Never squeezed to a letter a line: the buttons beside it keep short on a phone. */}
            <div className={`min-w-[7rem] flex-1 ${stacked ? 'px-12 text-center' : ''}`}>
              {caption ? <p className="text-base text-p03-dim">{caption}</p> : null}
              <h2 className="text-xl leading-tight text-balance [overflow-wrap:anywhere] text-p03 sm:text-3xl">
                {title}
              </h2>
            </div>
            {stacked ? null : centerSlot}
            {stacked ? <div className="absolute top-0 right-0">{menu}</div> : buttonRow}
          </header>
          {deckDrawer}
          {/* The inventory's column grows from nothing as it opens and shrinks as it closes, so the screen beside it widens and narrows smoothly. */}
          <m.div
            initial={false}
            animate={{
              gridTemplateColumns: showDock ? 'minmax(0px, 1fr) 20rem' : 'minmax(0px, 1fr) 0rem',
              columnGap: showDock ? '1rem' : '0rem',
            }}
            transition={{ duration: still ? 0 : 0.2, ease: 'easeOut' }}
            className="relative z-10 grid min-h-0 flex-1 gap-y-4"
          >
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <div ref={setBar} className={`shrink-0 empty:hidden ${stacked ? 'text-center' : ''}`} />
              {stacked ? buttonRow : null}
              {/* Only the content scrolls, inside a frame that stays the same size; padded so focus rings aren't cut. */}
              <div data-scroller className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-1 ${FADE}`}>
                {/* A screen marked data-center, such as a card choice or an empty one, sits in the middle. */}
                {/* Fades in on load and as each screen takes its place, as the projector's screens do. */}
                <m.div
                  key={title}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="has-[[data-center]]:my-auto"
                >
                  {children}
                </m.div>
              </div>
            </div>
            {/* Slides in as it opens and away before it goes; already open on load, it's simply there. */}
            <AnimatePresence initial={false}>
              {showDock ? (
                <m.aside
                  id="run-deck"
                  aria-label="Your inventory"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  className="min-h-0 overflow-hidden"
                >
                  {/* Its own width throughout, so nothing reflows while its column grows or shrinks around it. */}
                  <Panel className="flex h-full min-h-0 w-[20rem] flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-p03">Inventory</h2>
                      <button
                        type="button"
                        onClick={() => dock(false)}
                        aria-label="Close the inventory"
                        className={ICON_BUTTON}
                      >
                        <X aria-hidden className="size-5" />
                      </button>
                    </div>
                    <HeldTools items={state.items} label="Tools" />
                    <h3 className="text-p03">Deck ({state.deck.length})</h3>
                    <div className={`min-h-0 flex-1 overflow-y-auto px-1 ${FADE}`}>
                      <DeckTable deck={state.deck} caption="Your deck" />
                    </div>
                  </Panel>
                </m.aside>
              ) : null}
            </AnimatePresence>
          </m.div>
        </m.div>
      </SearchContext>
    </SlotContext>
  )
}
