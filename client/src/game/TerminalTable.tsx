import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react'
import { Box, Flag, LogOut, Maximize, Minimize, ScrollText, SquareTerminal } from 'lucide-react'
import { Link } from 'react-router'
import { card, HAND_LIMIT, legalActions, TIP, type Action, type Slot, type Unit } from 'shared'
import {
  SeatNote,
  type Seat,
  describe,
  GameOver,
  has,
  laneAction,
  owed,
  prompt,
  ScaleBar,
  scaleWords,
  Forfeit,
} from './controls.tsx'
import type { Playback } from './table/playback.ts'
import { usePlayback } from './table/usePlayback.ts'
import { CARD_RATIO, FlatReaderBody, PixelCard, ReaderBody } from './CardReader.tsx'
import FaultyScreen from '../components/p03/FaultyScreen.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx'
import { useFullScreen } from './fullScreen.ts'
import type { Ready } from './useGame.ts'
import { useMedia } from '../lib/useMedia.ts'
import { authClient } from '../lib/auth.ts'

// P03's terminal, for the landscape table's menu; loaded only when opened.
const Terminal = lazy(() => import('../components/p03/Terminal.tsx'))
const TERMINAL_LINES = ['Lost already? Type help.', 'Or tutorial, if you need it spelled out.']

// The text table laid out as Inscryption's Act 2, in P03's green: the scale and the button on the left, the board in
// the middle, the card being looked at on the right, and the hand along the bottom.

/** Where the scale stands, drawn as a balance: whoever takes damage has it land in their pan. */
function Balance({ scale }: { scale: number }) {
  const lean = Math.max(-1, Math.min(1, scale / TIP))
  // The player's pan is on the left; the leader's pan sinks, and the marker below points the same way.
  const angle = (-lean * 16 * Math.PI) / 180
  const [cx, cy, arm] = [100, 42, 70]
  const end = (side: number) => [cx + side * arm * Math.cos(angle), cy + side * arm * Math.sin(angle)] as const
  const [left, right] = [end(-1), end(1)]
  const ends = [left, right]
  const ticks = [...Array(TIP * 2 + 1).keys()].map((i) => i - TIP)
  return (
    <div
      role="meter"
      aria-label="The scale"
      aria-valuemin={-TIP}
      aria-valuemax={TIP}
      aria-valuenow={Math.max(-TIP, Math.min(TIP, scale))}
      aria-valuetext={scaleWords(scale)}
      className="flex flex-col items-center"
    >
      <svg viewBox="0 0 200 150" className="max-h-[14dvh] w-full" shapeRendering="crispEdges" aria-hidden>
        <g stroke="#7dff9a" fill="none" strokeWidth={3}>
          {/* The post: a column with vents, standing on a plinth, the hub at the top. */}
          <rect x={94} y={48} width={12} height={82} />
          {[62, 78, 94, 110].map((y) => (
            <line key={y} x1={97} y1={y} x2={103} y2={y} strokeWidth={2} />
          ))}
          <rect x={72} y={130} width={56} height={10} fill="#0b1f12" />
          <rect x={92} y={36} width={16} height={12} fill="#0b1f12" />
          <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} strokeWidth={4} />
          {ends.map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x - 16} y2={y + 44} strokeWidth={2} />
              <line x1={x} y1={y} x2={x + 16} y2={y + 44} strokeWidth={2} />
              <path d={`M${x - 24} ${y + 44} h48 l-8 10 h-32 z`} fill="#0b1f12" />
            </g>
          ))}
        </g>
        {ends.map(([x, y], i) => (
          <g key={i} fontFamily="VT323" textAnchor="middle">
            <text x={x} y={y + 70} fill="#7dff9a" fontSize={16}>
              {i === 0 ? 'YOU' : 'P03'}
            </text>
            {/* The lead, weighing in the leader's pan. */}
            {(i === 0 ? scale > 0 : scale < 0) ? (
              <text x={x} y={y + 41} fill="#b8f5c4" fontSize={18}>
                x{Math.abs(scale)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {/* The ruler under it, as in Act 2, with the marker at the lead. */}
      <div className="relative mt-1 flex h-4 w-full items-end justify-between border-b-2 border-p03-dim">
        {ticks
          .filter((t) => t % 4 === 0)
          .map((t) => (
            <span key={t} className={`w-[2px] bg-p03-dim ${t === 0 ? 'h-4' : 'h-2'}`} />
          ))}
        <span
          className="absolute -top-3 -translate-x-1/2 text-p03 transition-all duration-300"
          // Toward whoever leads, as the bar's knot is on the 3D table.
          style={{ left: `${50 - lean * 50}%` }}
        >
          ▼
        </span>
      </div>
      <p className={`mt-1 text-lg ${scale > 0 ? 'text-foreground' : scale < 0 ? 'text-death' : 'text-p03-dim'}`}>
        {scaleWords(scale)}
      </p>
    </div>
  )
}

// The left column's buttons: bordered like its panels, in the terminal's type.
const SIDE_BUTTON =
  'rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 font-terminal text-lg text-p03 hover:bg-[#13261a] hover:text-p03 aria-expanded:bg-[#13261a] aria-expanded:text-p03 dark:hover:bg-[#13261a] dark:aria-expanded:bg-[#13261a]'

// The landscape menu's buttons: the same, with an icon before the name.
const MENU_BUTTON = `${SIDE_BUTTON} flex items-center justify-center gap-2`

function Panel({
  children,
  className = '',
  ref,
}: {
  children: ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={ref} className={`rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 ${className}`}>
      {children}
    </div>
  )
}

// From this wide, the reader has room for the art beside the words, and lies flat; narrower, it stands them in a column.
const FLAT_READER = 416

/** Whether the reader lies flat, decided by the reader's own width rather than the window's. */
function useFlatReader(): [(element: HTMLDivElement | null) => void, boolean] {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [flat, setFlat] = useState(false)
  useEffect(() => {
    if (!box) return
    const observer = new ResizeObserver(([entry]) => entry && setFlat(entry.contentRect.width >= FLAT_READER))
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  return [setBox, flat]
}

type BoardRow = 'back' | 'front' | 'board'
type Place = { row: BoardRow; lane: number } | { uid: number }

// How long a lunge takes, as on the 3D table.
const LUNGE_MS = 240

/**
 * What stands in a lane as the moves play back: the card, arriving or lunging; a card on its way out, folding away
 * toward its owner or offered up; and the numbers rising off it.
 */
function Occupant({
  row,
  lane,
  unit,
  playback,
  empty = null,
  tilted = false,
  fresh,
}: {
  row: BoardRow
  lane: number
  unit: Slot
  playback: Playback
  empty?: ReactNode
  tilted?: boolean
  /** Whether a card arrived after the page loaded, and so arrives on screen too. */
  fresh: (uid: number) => boolean
}) {
  const lunge = unit ? playback.lunges.get(unit.uid) : undefined
  // Keyed by when it began, a lunge plays once, the moment it is added.
  const striking = lunge
  const leaving = playback.leaving.filter((gone) => gone.row === row && gone.lane === lane)
  const popups = playback.popups.filter(
    (popup) => 'row' in popup.spot && popup.spot.row === row && popup.spot.lane === lane,
  )
  return (
    <span className="relative block size-full">
      {unit ? (
        <span
          key={unit.uid}
          className={`block size-full transition-transform duration-200 ${tilted ? '-translate-y-1 rotate-6' : ''}`}
          style={
            fresh(unit.uid)
              ? { animation: `${row === 'board' ? 'arrive-up' : 'arrive-down'} 280ms ease-out` }
              : undefined
          }
        >
          <span
            key={striking ? striking.at : 'still'}
            className="block size-full"
            style={
              striking
                ? { animation: `${row === 'board' ? 'lunge-up' : 'lunge-down'} ${LUNGE_MS}ms ease-in-out` }
                : undefined
            }
          >
            <PixelCard unit={unit} />
          </span>
        </span>
      ) : (
        empty
      )}
      {leaving.map((gone) => (
        <span
          key={`gone-${gone.unit.uid}`}
          aria-hidden
          className="absolute inset-0"
          // Dead, it folds shut and goes toward its owner; sacrificed, it is offered up.
          style={
            {
              animation: `${gone.how === 'sacrificed' ? 'offer-up' : 'fold-away'} 550ms ease-in forwards`,
              '--away': row === 'board' ? '60%' : '-60%',
            } as CSSProperties
          }
        >
          <PixelCard unit={gone.unit} />
        </span>
      ))}
      {popups.map((popup) => (
        <Rising key={popup.id} text={popup.text} tone={popup.tone} />
      ))}
    </span>
  )
}

function Rising({ text, tone, className = 'top-1/2 left-1/2' }: { text: string; tone: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 text-3xl whitespace-nowrap [text-shadow:0_0_6px_#000,0_0_2px_#000] ${className} ${tone === 'heal' ? 'text-p03' : tone === 'note' ? 'text-[#f2c14e]' : 'text-death'}`}
      style={{ animation: 'rise 1s ease-out forwards' }}
    >
      {text}
    </span>
  )
}

/** The largest lane that fits the space given, four across and three down: the board takes the window's height. */
function useLaneSize(
  narrow: boolean,
  hand: HTMLElement | null,
  aside = 0,
  floor = 40,
  fill: boolean | 'width' = false,
) {
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState(96)
  const current = useRef(96)
  useEffect(() => {
    if (!area) return
    const fit = () => {
      // The panel's padding and border, the gaps between lanes, and the line between P03's rows and the player's.
      // Filling, the board's column is only as wide as the board, so the window's width is what limits it.
      const width = ((fill ? window.innerWidth : area.clientWidth) - aside - 28 - 3 * (narrow ? 4 : 8)) / 4
      // Compact, the lanes take up whatever room the hand leaves above the window's bottom, three rows of them,
      // measured as if the page were scrolled to the top, so scrolling never grows the board.
      const table = hand?.closest<HTMLElement>('[data-table]')
      const fixed = table ? getComputedStyle(table).position === 'fixed' : false
      const scrolled = (fixed ? 0 : window.scrollY) + (table?.scrollTop ?? 0)
      const room = hand ? window.innerHeight - 12 - (hand.getBoundingClientRect().bottom + scrolled) : 0
      const height =
        narrow && !fill
          ? current.current + room / (3 * CARD_RATIO)
          : fill === 'width'
            ? Infinity
            : (area.clientHeight - 28 - 3 * 8 - 2) / 3 / CARD_RATIO
      // Never smaller than the floor, so a short landscape phone still has a board to play on (the page scrolls to the
      // hand); never taller than the window, so it can still be seen whole.
      const tallest = (window.innerHeight - 24 - 28 - 3 * 4 - 2) / 3 / CARD_RATIO
      current.current = Math.floor(Math.min(width, Math.max(floor, Math.min(height, tallest))))
      setSize(current.current)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(area)
    if (hand) observer.observe(hand)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [area, narrow, hand, aside, floor, fill])
  return { setArea, lane: { width: size, height: size * CARD_RATIO } }
}

/** A scrolling list that keeps to its newest line as lines arrive, unless it has been scrolled back to read. */
function useStuckToBottom(content: unknown) {
  const box = useRef<HTMLElement | null>(null)
  const stuck = useRef(true)
  // A list that appears, as in a modal, opens on its newest line.
  const attach = useCallback((element: HTMLElement | null) => {
    box.current = element
    stuck.current = true
    if (element) element.scrollTop = element.scrollHeight
  }, [])
  useLayoutEffect(() => {
    const element = box.current
    if (element && stuck.current) element.scrollTop = element.scrollHeight
  }, [content])
  const onScroll = useCallback(() => {
    const element = box.current
    if (element) stuck.current = element.scrollHeight - element.scrollTop - element.clientHeight < 8
  }, [])
  return [attach, onScroll] as const
}

// The widest the table grows, and how tall it may be for its width, so a big window does not stretch it into a tower.
const MOST_WIDE = 1792
const MOST_TALL = 0.62

/**
 * The table's size: as wide as the page allows up to a cap, as tall as the window below it allows, and no taller than
 * its width suits. In full screen it is the same, centred on the whole screen.
 */
function useFit(full: boolean) {
  const frame = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<CSSProperties>({ width: '100%', height: '75dvh' })
  useLayoutEffect(() => {
    const fit = () => {
      const element = frame.current
      if (!element) return
      const margin = 16
      let width: number
      let room: number
      if (full) {
        width = Math.min(MOST_WIDE, window.innerWidth - margin * 2)
        room = window.innerHeight - margin * 2
      } else {
        const parent = element.parentElement as HTMLElement
        const style = getComputedStyle(parent)
        // Inside the page's padding.
        const inner = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        width = Math.min(MOST_WIDE, inner)
        // From where the table starts on the page, however tall the header is at this zoom.
        room = window.innerHeight - (element.getBoundingClientRect().top + window.scrollY) - margin
      }
      // Never shorter than its columns need: on a window smaller still, the page scrolls rather than cutting parts off.
      const height = Math.max(600, Math.min(room, width * MOST_TALL))
      setSize(
        full
          ? { width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 }
          : { width, height },
      )
    }
    fit()
    window.addEventListener('resize', fit)
    const observer = new ResizeObserver(fit)
    if (frame.current?.parentElement) observer.observe(frame.current.parentElement)
    return () => {
      window.removeEventListener('resize', fit)
      observer.disconnect()
    }
  }, [full])
  return { frame, size }
}

const PROCESSES = ['p03.core', 'scale.svc', 'sacrifice.d', 'lane.watch', 'gc.reaper', 'deck.shuf']

/** P03's idle process monitor, in the space under the button; shown once its heading and a line fit, and scrolling. */
function Processes() {
  const [tick, setTick] = useState(0)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 900)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!box) return
    // The heading and one line, each about 1.5rem, and the padding.
    const measure = () =>
      setFits(box.clientHeight >= 4.5 * parseFloat(getComputedStyle(document.documentElement).fontSize))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  // A steady wander rather than noise, from the tick, so it reads as work being done.
  const load = (i: number) =>
    Math.round(4 + 4 * (1 + Math.sin(tick * 0.7 + i * 1.9)) * (0.5 + 0.5 * Math.cos(tick * 0.23 + i)))
  return (
    <div ref={setBox} aria-hidden className="min-h-0 flex-1">
      {fits ? (
        <div className="flex h-full flex-col overflow-y-auto rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2 text-base text-p03-dim">
          <p className="text-p03">// PROCESSES</p>
          {PROCESSES.map((name, i) => (
            <p key={name} className="flex justify-between gap-2 whitespace-pre">
              <span>{name}</span>
              <span className="text-p03">{'|'.repeat(load(i)).padEnd(12, '.')}</span>
            </p>
          ))}
          <p className="mt-auto pt-1">
            mem {String(40 + ((tick * 7) % 23)).padStart(2)}% · up {tick}s
            <span className={tick % 2 ? 'invisible' : ''}>_</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** The text table laid out as Act 2: a whole game through its buttons, played back one move at a time. */
export function TerminalTable({
  game,
  seat,
  on3d,
  layout = 'wide',
}: {
  game: Ready
  seat: Seat
  on3d: () => void
  /** Wide, three columns; mid, the board beside the reader; narrow, one column down to 320px; landscape, a phone on its side. */
  layout?: 'wide' | 'mid' | 'narrow' | 'landscape'
}) {
  const narrow = layout !== 'wide'
  // Landscape turned upright, or on a phone too narrow for its side columns, stacks its pieces around a board of the
  // same size; shorter than 680px, the stack scrolls rather than squeezing the board, as on old 320x480 phones.
  const upright = useMedia('(orientation: portrait)')
  const slim = useMedia('(max-width: 40rem)')
  const cramped = useMedia('(max-height: 42.5rem)')
  const sideways = layout === 'landscape' && !upright && !slim
  const scrolling = layout === 'landscape' && !sideways && cramped
  const { state, act, result } = game
  // The page shows the game as far as its playback has reached; moves come from the real state, and wait for it.
  const { playback, busy } = usePlayback(game)
  const view = playback.view
  const legal = busy || result ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  // At the limit the draw is skipped; the piles say so.
  const handFull = !busy && !result && state.player.hand.length >= HAND_LIMIT && !state.drawn
  // Where the pointer was, not the card that was there: a card played into that lane shows at once.
  const [looking, setLooking] = useState<Place | null>(null)
  const fullScreen = useFullScreen()
  const { frame, size } = useFit(fullScreen.on)
  // Less print on short tables.
  const height = typeof size.height === 'number' ? size.height : 900
  const short = height < 760
  const at = (place: Place | null) =>
    !place
      ? null
      : 'uid' in place
        ? (view.hand.find((unit) => unit.uid === place.uid) ?? null)
        : (view[place.row][place.lane] ?? null)
  // The card being summoned holds the reader until it is played or put back.
  const inspected = summoning ?? at(looking) ?? null
  // The reader keeps the last card pointed at, as Act 2's does: leaving it, or a zoom moving the page under a still
  // pointer, does not empty it. Pointing at an empty lane leaves it too.
  // On touch, holding a card magnifies it above the finger; letting go does not play it.
  const [magnified, setMagnified] = useState<{ unit: Unit; x: number; y: number } | null>(null)
  const [readerBox, readerFlat] = useFlatReader()
  // Landscape keeps the table's controls in a menu.
  const [menu, setMenu] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  // On a phone, with no reader beside the board, a tap opens the card in a modal instead.
  const tapToRead = layout === 'landscape'
  const [reading, setReading] = useState<Place | null>(null)
  const user = (authClient.useSession().data?.user as { displayUsername?: string } | undefined)?.displayUsername
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const letGo = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
    setMagnified(null)
  }
  // Once a hold opens the magnifier, sliding the finger or the pointer reads whatever card it is over, and the page
  // stays still.
  const magnifying = magnified !== null
  useEffect(() => {
    if (!magnifying) return
    const touchMove = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      if (touch) move(touch)
    }
    const pointerMove = (event: PointerEvent) => event.pointerType === 'mouse' && move(event)
    const move = (touch: { clientX: number; clientY: number }) => {
      const key = document.elementFromPoint(touch.clientX, touch.clientY)?.closest<HTMLElement>('[data-look]')?.dataset[
        'look'
      ]
      const place: Place | null = !key
        ? null
        : key.startsWith('uid:')
          ? { uid: Number(key.slice(4)) }
          : { row: key.split(':')[0] as BoardRow, lane: Number(key.split(':')[1]) }
      const unit = at(place)
      if (place && unit) setLooking(place)
      setMagnified((last) => (last ? { unit: unit ?? last.unit, x: touch.clientX, y: touch.clientY } : last))
    }
    const end = () => setMagnified(null)
    document.addEventListener('touchmove', touchMove, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    document.addEventListener('pointermove', pointerMove)
    document.addEventListener('pointerup', end)
    return () => {
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      document.removeEventListener('pointermove', pointerMove)
      document.removeEventListener('pointerup', end)
    }
  })
  const look = (place: Place, unit: Slot | Unit = null) => ({
    'data-look': 'uid' in place ? `uid:${place.uid}` : `${place.row}:${place.lane}`,
    onPointerEnter: () => unit && setLooking(place),
    onFocus: () => unit && setLooking(place),
    onPointerDown: (event: React.PointerEvent) => {
      if (!unit || (event.pointerType !== 'touch' && event.button !== 0)) return
      held.current = false
      const [x, y] = [event.clientX, event.clientY]
      hold.current = setTimeout(() => {
        held.current = true
        setLooking(place)
        setMagnified({ unit, x, y })
      }, 280)
    },
    onPointerUp: letGo,
    onPointerCancel: letGo,
    // A finger or button held down stays on its card until lifted, and the page's listeners let it go; a pointer that
    // leaves before the hold is up simply stops waiting.
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === 'touch' || magnified) return
      if (hold.current) clearTimeout(hold.current)
      hold.current = null
    },
  })
  // The cards on the table when the page opened are simply there; only those dealt, drawn or queued since arrive.
  const [present] = useState(
    () =>
      new Set(
        [...state.player.hand, ...state.player.board, ...state.opponent.front, ...state.opponent.back].flatMap(
          (unit) => (unit ? [unit.uid] : []),
        ),
      ),
  )
  const fresh = (uid: number) => !present.has(uid)
  // Something tried that cannot be done yet shakes, and so does the prompt saying what comes first.
  const [refused, setRefused] = useState({ what: '', count: 0 })
  const refuse = (what: string) => setRefused((last) => ({ what, count: last.count + 1 }))
  const shaking = (what: string): CSSProperties | undefined =>
    refused.count && (refused.what === what || (what === 'piles' && mustDraw))
      ? { animation: 'shake 0.45s' }
      : undefined
  // E presses the button here too.
  const canPress = has(legal, { type: 'ringBell' })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement).tagName === 'INPUT') return
      if (canPress) act({ type: 'ringBell' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPress, act])

  // Landscape covers the whole screen, so the page under it must not scroll.
  useEffect(() => {
    if (layout !== 'landscape') return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [layout])

  // A lane's size comes from the board's height, so the whole table fits the window.
  const [handSection, setHandSection] = useState<HTMLElement | null>(null)
  const { setArea, lane: laneSize } = useLaneSize(
    narrow,
    handSection,
    layout === 'mid' ? 13 * 16 + 12 : sideways ? 21 * 16 + 32 : layout === 'landscape' ? 16 : 0,
    layout === 'mid' ? 76 : 40,
    // Scrolling, only the width limits the board.
    scrolling ? 'width' : layout === 'landscape',
  )
  const cell =
    'flex shrink-0 select-none items-center justify-center rounded-md border-2 p-1 [-webkit-touch-callout:none]'
  const faces = playback.popups.filter((popup) => 'face' in popup.spot)
  const over = result && !busy

  // The table's pieces, laid out wide in three columns, or narrow in one for small screens.
  const turnPanel = (
    <Panel className="flex items-center justify-between text-2xl">
      <span className="text-p03">Turn {view.turn}</span>
      <span className="text-base text-p03-dim" aria-live="polite">
        {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
      </span>
    </Panel>
  )
  const balancePanel = (
    <Panel>
      <Balance scale={view.scale} />
    </Panel>
  )
  const executeButton = (
    <button
      type="button"
      data-action="ringBell"
      disabled={!canPress}
      onClick={() => act({ type: 'ringBell' })}
      aria-keyshortcuts="E"
      aria-label="Press the button"
      className={`flex items-center justify-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] text-p03 enabled:hover:bg-[#13261a] disabled:[&>*]:opacity-40 ${layout === 'landscape' ? 'flex-1 flex-col gap-1 p-2' : narrow ? 'shrink-0 flex-row gap-2 px-2 py-1' : 'flex-col p-3'}`}
    >
      <span
        className={`grid place-items-center rounded-full border-[#2f6b3d] bg-[#a3172b] shadow-[0_0_14px_rgb(255_60_60/0.4)] ${layout === 'landscape' ? 'size-10 border-4' : narrow ? 'size-8 border-2' : 'size-[min(3.5rem,6dvh)] border-4'}`}
      />
      {/* Landscape turned upright on a 320px phone has room for the button's name only cut short. */}
      <span className={`tracking-widest ${narrow ? 'text-base' : 'text-2xl'}`}>
        {layout === 'landscape' && !sideways ? (
          <>
            <span className="max-[359px]:hidden">EXECUTE</span>
            <span className="min-[360px]:hidden">EXEC.</span>
          </>
        ) : (
          'EXECUTE'
        )}
      </span>
      {short || narrow ? null : <span className="text-sm text-p03-dim">press the button · E</span>}
    </button>
  )
  const boardPanel = (
    <Panel className="relative flex flex-col gap-2">
      {/* P03's face above the board and the player's below it, where hits to either land. */}
      {faces.map((popup) => (
        <Rising
          key={popup.id}
          text={popup.text}
          tone={popup.tone}
          className={'face' in popup.spot && popup.spot.face === 'opponent' ? 'top-0 left-1/2' : 'top-full left-1/2'}
        />
      ))}
      <div className={`flex justify-center ${narrow ? 'gap-1' : 'gap-2'}`} aria-label="P03's queue">
        {view.back.map((unit, i) => (
          <div
            key={i}
            {...look({ row: 'back', lane: i }, unit)}
            aria-label={unit ? `Queued in lane ${i + 1}: ${describe(unit)}` : `Lane ${i + 1}: nothing queued`}
            onClick={tapToRead && unit ? () => setReading({ row: 'back', lane: i }) : undefined}
            className={`${cell} border-[#1f3a26] brightness-75`}
            style={laneSize}
          >
            <Occupant
              row="back"
              fresh={fresh}
              lane={i}
              unit={unit}
              playback={playback}
              empty={<span className="grid size-full place-items-center text-5xl text-[#2f6b3d]">↓</span>}
            />
          </div>
        ))}
      </div>
      <div className={`flex justify-center ${narrow ? 'gap-1' : 'gap-2'}`} aria-label="P03's row">
        {view.front.map((unit, i) => (
          <div
            key={i}
            {...look({ row: 'front', lane: i }, unit)}
            aria-label={unit ? `P03's lane ${i + 1}: ${describe(unit)}` : `P03's lane ${i + 1}: empty`}
            onClick={tapToRead && unit ? () => setReading({ row: 'front', lane: i }) : undefined}
            className={`${cell} border-[#1f3a26]`}
            style={laneSize}
          >
            <Occupant row="front" lane={i} unit={unit} playback={playback} fresh={fresh} />
          </div>
        ))}
      </div>
      <div className="border-t-2 border-death/50" />
      <div className={`flex justify-center ${narrow ? 'gap-1' : 'gap-2'}`} aria-label="Your row">
        {view.board.map((unit, i) => {
          const action = laneAction(legal, i)
          const marked = state.summon?.marked.includes(i) ?? false
          // Paid for: a marked lane is where the card goes, so it says so, over the card being given up.
          const paid = marked && action?.type === 'place'
          const verb =
            action?.type === 'mark'
              ? 'Sacrifice'
              : action?.type === 'unmark'
                ? 'Spare'
                : action?.type === 'place'
                  ? 'Play here'
                  : null
          const label = `Lane ${i + 1}: ${unit ? describe(unit) : 'empty'}${verb ? `. ${verb}` : ''}${marked ? ', marked for sacrifice' : ''}`
          // A dashed outline on what can be clicked, red where a card would be given up, as in Act 2.
          const frame = paid
            ? 'border-dashed border-p03'
            : marked
              ? 'border-dashed border-death bg-[#2a1214]'
              : action?.type === 'mark'
                ? 'border-dashed border-death/70 hover:border-death'
                : action
                  ? 'border-dashed border-p03/60 hover:border-p03'
                  : 'border-[#1f3a26]'
          const body = (
            <>
              <Occupant
                row="board"
                fresh={fresh}
                lane={i}
                unit={unit}
                playback={playback}
                tilted={marked}
                empty={
                  verb ? (
                    <span className="grid size-full place-items-center text-center text-base leading-none text-p03-dim">
                      play here
                    </span>
                  ) : null
                }
              />
              {paid ? (
                <span className="absolute inset-x-1 bottom-1 z-10 rounded-sm bg-[#07130b]/90 py-0.5 text-center text-base text-p03">
                  ↓ play here
                </span>
              ) : null}
            </>
          )
          // The lane's card stays put while the lane becomes clickable and back, so nothing plays again.
          return (
            <div
              key={i}
              aria-label={action ? undefined : label}
              {...look({ row: 'board', lane: i }, unit)}
              onClick={
                action
                  ? undefined
                  : tapToRead && unit
                    ? () => setReading({ row: 'board', lane: i })
                    : () => !busy && refuse(`lane-${i}`)
              }
              className={`${cell} relative ${frame}`}
              style={{ ...laneSize, ...shaking(`lane-${i}`) }}
            >
              {body}
              {action ? (
                <button
                  type="button"
                  aria-label={label}
                  data-action={action.type}
                  data-lane={i}
                  onClick={() => act(action)}
                  className="absolute inset-0 z-20 rounded-md"
                />
              ) : null}
            </div>
          )
        })}
      </div>
      {over ? (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
          <GameOver result={result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
        </div>
      ) : null}
    </Panel>
  )
  const said = busy
    ? "P03's turn…"
    : prompt(mustDraw, summoning, summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0)
  const [consoleBox, consoleScroll] = useStuckToBottom(game.log.length)
  const [saysBox, saysScroll] = useStuckToBottom(`${game.log.length} ${said}`)
  const [modalBox, modalScroll] = useStuckToBottom(game.log.length)
  const promptLine = (
    <p
      key={refused.count}
      title={said}
      className={`text-p03-dim ${layout === 'narrow' ? 'h-[2lh] w-full overflow-y-auto text-lg leading-tight' : layout === 'landscape' ? 'w-full text-lg leading-tight text-p03' : layout === 'mid' ? 'w-full truncate text-[clamp(1rem,4.4cqi,1.25rem)]' : 'w-full truncate text-center text-[clamp(1rem,4cqi,1.5rem)]'}`}
      style={refused.count ? { animation: 'nudge 0.6s ease-out' } : undefined}
    >
      {said}
    </p>
  )
  const readerPanel = (
    <Panel
      ref={readerBox}
      className={`@container flex gap-2 bg-[#a9e7b8] text-[#0b1f12] ${readerFlat ? 'flex-row overflow-hidden p-2' : 'flex-col overflow-hidden'} ${narrow ? (layout === 'mid' ? (readerFlat ? 'h-[min(20rem,72%)] min-h-0' : 'max-h-[80%] min-h-0') : 'h-56') : 'max-h-[70%] shrink-0'}`}
    >
      {inspected ? (
        readerFlat ? (
          <FlatReaderBody unit={inspected} />
        ) : (
          <ReaderBody unit={inspected} />
        )
      ) : (
        <p className="text-lg leading-snug">{narrow ? 'Tap' : 'Point at'} a card to read it.</p>
      )}
    </Panel>
  )
  // Narrow, the reader lies flat, the art beside the words, so it does not run the length of the page.
  const flatReader = (
    <Panel className="flex h-44 gap-2 bg-[#a9e7b8] p-2 text-[#0b1f12]">
      {inspected ? (
        <FlatReaderBody unit={inspected} />
      ) : (
        <p className="text-lg leading-snug">Tap a card to read it; hold it to look closer.</p>
      )}
    </Panel>
  )
  // The turn, the scale as a bar, and the button, in one strip over the board.
  const topStrip = (
    <div className="relative z-10 flex items-stretch gap-2">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] px-2 py-1">
        <p className="flex items-baseline justify-between gap-2 text-lg">
          <span className="text-p03">Turn {view.turn}</span>
          <span className="text-sm text-p03-dim" aria-live="polite">
            {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
          </span>
        </p>
        <ScaleBar scale={view.scale} fluid className="gap-1 text-base" />
      </div>
      {executeButton}
    </div>
  )
  const magnifier = magnified ? (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[60] w-40 drop-shadow-[0_0_12px_rgb(0_0_0/0.8)]"
      // Above the finger, or beside it where there is no room above.
      style={
        magnified.y - 250 >= 8
          ? { left: Math.min(Math.max(8, magnified.x - 80), window.innerWidth - 168), top: magnified.y - 250 }
          : {
              left: magnified.x > window.innerWidth / 2 ? magnified.x - 184 : magnified.x + 24,
              top: Math.min(Math.max(8, magnified.y - 112), window.innerHeight - 232),
            }
      }
    >
      <PixelCard unit={magnified.unit} />
      {/* The same glass as the 3D table's magnified cards. */}
      <span className="crt-glass absolute inset-0 [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)]" />
    </div>
  ) : null
  // Oldest first; a short log sits at the bottom, where the newest line is.
  const logItems = game.log.map((line, index) => (
    <li key={index} className="first:mt-auto">
      {line}
    </li>
  ))
  const consolePanel = (
    <section
      aria-label="P03's console"
      className={`flex flex-col rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 text-base ${layout === 'narrow' ? 'h-36' : 'min-h-16 flex-1 basis-0'}`}
    >
      <ol
        ref={consoleBox}
        onScroll={consoleScroll}
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto text-lg"
      >
        {logItems}
      </ol>
    </section>
  )
  // Always in its place, and only pressable while summoning, so nothing moves when it can be.
  const cancelButton = (
    <button
      type="button"
      {...(state.summon ? { 'data-action': 'cancel' } : {})}
      disabled={!state.summon}
      onClick={() => act({ type: 'cancel' })}
      className={`${SIDE_BUTTON} w-full disabled:opacity-40 disabled:hover:bg-[#07130b] ${layout === 'mid' || layout === 'narrow' ? 'mt-1' : ''}`}
    >
      Cancel
    </button>
  )
  const controlsPanel = (
    <div className={`flex shrink-0 flex-col justify-end gap-2 ${narrow ? '' : 'w-[17rem] self-stretch'}`}>
      <div className="flex gap-2">
        {fullScreen.supported ? (
          <button type="button" onClick={fullScreen.toggle} className={`${SIDE_BUTTON} flex-1 whitespace-nowrap`}>
            {fullScreen.on ? 'Exit full screen' : 'Full screen'}
          </button>
        ) : null}
        <Forfeit forfeit={game.forfeit} className={`${SIDE_BUTTON} h-auto flex-1 justify-center`} />
      </div>
      <div className="flex justify-between font-sans text-sm text-p03-dim">
        <button type="button" onClick={on3d} className="underline hover:text-p03">
          Play on the 3D table
        </button>
      </div>
    </div>
  )
  const handCards = (
    // A box the cards scroll in, so a full hand never runs over the controls or the piles.
    <div
      className={`flex min-w-0 flex-1 gap-2 rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-1 pb-1 ${sideways ? 'min-h-0 flex-wrap content-start justify-center overflow-y-auto pt-3' : `justify-[safe_center] items-center overflow-x-auto ${layout === 'landscape' ? 'pt-3' : 'pt-5'}`} ${narrow ? '' : 'h-full'}`}
    >
      {view.hand.map((unit) => {
        const selected = unit.uid === state.summon?.uid
        const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
        return (
          // The pointer is watched here, and the button is never disabled, so every card can be read and a card
          // that cannot be played yet can say so by shaking.
          <div
            key={unit.uid}
            {...look({ uid: unit.uid }, unit)}
            className={`shrink-0 select-none [-webkit-touch-callout:none] ${narrow ? (layout === 'mid' ? 'w-[clamp(5rem,6.5vw,6.5rem)]' : layout === 'landscape' && !sideways ? 'w-12 tall:w-14' : 'w-14') : 'aspect-[5/7] h-full'}`}
            style={fresh(unit.uid) ? { animation: 'arrive-up 280ms ease-out' } : undefined}
          >
            <button
              type="button"
              // On a phone a card that cannot be played still opens to be read.
              aria-disabled={!allowed && !selected && !tapToRead}
              aria-pressed={selected}
              aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
              data-action="select"
              data-uid={unit.uid}
              // On a phone, a tap selects the card if it can; otherwise, or on the card already selected, it reads it.
              onClick={() =>
                tapToRead && (selected || !allowed)
                  ? setReading({ uid: unit.uid })
                  : allowed
                    ? act({ type: 'select', uid: unit.uid })
                    : !selected && !busy && refuse(`card-${unit.uid}`)
              }
              className={`w-full rounded-md p-1 transition-transform ${selected ? '-translate-y-3 outline-2 outline-p03 outline-dashed' : allowed ? 'hover:-translate-y-1' : 'brightness-50 saturate-50'}`}
            >
              <span
                key={refused.what === `card-${unit.uid}` ? refused.count : 0}
                className="block"
                style={shaking(`card-${unit.uid}`)}
              >
                <PixelCard unit={unit} />
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
  const pilesPanel = (
    // Boxed like the hand, except in the wide layout, where they stand on the table's edge.
    <div
      key={refused.count}
      className={`flex shrink-0 gap-3 ${narrow ? 'items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-2 pt-2 pb-1' : ''}`}
      style={shaking('piles')}
    >
      <button
        type="button"
        data-action="draw-deck"
        disabled={!mustDraw}
        data-full={handFull || undefined}
        title={handFull ? `Your hand is full (${HAND_LIMIT}): no draw this turn` : undefined}
        onClick={() => act({ type: 'draw', from: 'deck' })}
        aria-label={`Draw from the deck, ${view.deck} left`}
        className={`flex flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50 ${sideways ? 'w-10' : layout === 'landscape' ? 'w-8 tall:w-10' : narrow ? 'w-12 sm:w-16' : 'w-20'}`}
      >
        <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-[#2f6b3d] bg-[#0b1f12] text-3xl shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
          ▦
        </span>
        <span className="text-lg">x{view.deck}</span>
      </button>
      <button
        type="button"
        data-action="draw-boilerplate"
        disabled={!mustDraw}
        data-full={handFull || undefined}
        title={handFull ? `Your hand is full (${HAND_LIMIT}): no draw this turn` : undefined}
        onClick={() => act({ type: 'draw', from: 'boilerplate' })}
        aria-label="Take a Boilerplate"
        className={`flex flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50 ${sideways ? 'w-10' : layout === 'landscape' ? 'w-8 tall:w-10' : narrow ? 'w-12 sm:w-16' : 'w-20'}`}
      >
        <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-[#0b1f12] bg-[#a9e7b8] text-lg text-[#0b1f12] shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
          {'</>'}
        </span>
        <span className="text-lg">∞</span>
      </button>
    </div>
  )

  // A held card was being read, not played.
  const holding = {
    onContextMenu: (event: React.MouseEvent) => (hold.current || held.current) && event.preventDefault(),
    onClickCapture: (event: React.MouseEvent) => {
      if (!held.current) return
      held.current = false
      event.stopPropagation()
      event.preventDefault()
    },
  }

  if (!narrow)
    return (
      <>
        {/* In full screen, the page behind the table goes dark. */}
        {fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
        <div
          data-game-id={game.id}
          data-seed={state.seed}
          data-table="text"
          {...holding}
          ref={frame}
          // Sized to the room it has, in the page or the whole screen; the classes never fight over position or size.
          style={size}
          className={`p03-screen crt grid grid-cols-[17rem_minmax(0,1fr)_22rem] grid-rows-[minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-lg border border-[#2f6b3d] p-4 font-terminal text-2xl ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`}
        >
          {/* P03's faulty screen behind it all, and the glass over it: scanlines, a rolling band and dark corners. */}
          <FaultyScreen />
          <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
          <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
            {turnPanel}
            {balancePanel}
            {executeButton}
            <Processes />
          </aside>
          <section aria-label="The table" className="relative z-10 flex min-h-0 flex-col items-center gap-2">
            {seat ? <SeatNote seat={seat} /> : null}
            <div ref={setArea} className="flex min-h-0 w-full flex-1 items-center justify-center">
              {boardPanel}
            </div>
            <div className="@container w-full">{promptLine}</div>
          </section>
          <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
            {readerPanel}
            {consolePanel}
            {cancelButton}
          </aside>
          <section
            aria-label="Your hand"
            className="relative z-10 col-span-3 flex h-[clamp(8rem,19dvh,13rem)] items-end gap-4 border-t-2 border-[#2f6b3d] pt-3"
          >
            {controlsPanel}
            {handCards}
            {pilesPanel}
          </section>
          {magnifier}
        </div>
      </>
    )

  // Landscape, a phone on its side: the whole screen, the board as tall as it goes in the middle; the turn, the scale
  // and the hand on the left; the piles, the button and what P03 says on the right. No reader or log: holding a card
  // magnifies it. Turned upright, the same pieces stack above and below a board of about the same size.
  if (layout === 'landscape') {
    const readUnit = at(reading)
    // Why a card in the hand could not be picked, where that is why it opened; beside the close button, in the space it
    // leaves.
    const readNote =
      !reading || !('uid' in reading) || result
        ? null
        : reading.uid === state.summon?.uid
          ? 'Being summoned'
          : busy
            ? "P03's turn"
            : mustDraw
              ? 'Draw first'
              : has(legal, { type: 'select', uid: reading.uid } as Partial<Action>)
                ? null
                : 'Not enough to sacrifice'
    const status = (
      <div className="flex items-center gap-2 text-lg">
        <span className="text-p03">Turn {view.turn}</span>
        <span className="ml-auto truncate text-sm text-p03-dim" aria-live="polite">
          {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
        </span>
        <button
          type="button"
          aria-expanded={menu}
          aria-label="Menu"
          onClick={() => setMenu((open) => !open)}
          className="rounded px-2 text-2xl leading-none text-p03 hover:bg-[#13261a]"
        >
          ≡
        </button>
      </div>
    )
    // The log, scrolled to its end, with what to do now as its newest line.
    // Short and upright, the box holds the prompt alone rather than a clipped line of the log.
    const says = (className: string, log = 'block') => (
      <div
        ref={saysBox}
        onScroll={saysScroll}
        className={`@container flex flex-col gap-1 overflow-y-auto rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 p-2 ${className}`}
      >
        <ol aria-live="polite" className={`mt-auto text-base leading-tight text-p03-dim ${log}`}>
          {logItems}
        </ol>
        {promptLine}
      </div>
    )
    const menuPanel = menu ? (
      <div
        className={`absolute top-12 z-40 flex w-72 max-w-[calc(100%-1rem)] flex-col gap-3 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 ${sideways ? 'left-2' : 'right-2'}`}
      >
        {seat ? <SeatNote seat={seat} /> : null}
        <div className="grid grid-cols-2 gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              setLogOpen(true)
            }}
            className={MENU_BUTTON}
          >
            <ScrollText aria-hidden />
            Battle log
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              setTerminalOpen(true)
            }}
            className={MENU_BUTTON}
          >
            <SquareTerminal aria-hidden />
            Terminal
          </button>
          {fullScreen.supported ? (
            <button type="button" onClick={fullScreen.toggle} className={`${MENU_BUTTON} whitespace-nowrap`}>
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {fullScreen.on ? 'Exit full screen' : 'Full screen'}
            </button>
          ) : null}
          <Forfeit forfeit={game.forfeit} className={`${MENU_BUTTON} h-auto`}>
            <Flag aria-hidden />
            Forfeit
          </Forfeit>
          <button type="button" onClick={on3d} className={MENU_BUTTON}>
            <Box aria-hidden />
            3D Table
          </button>
          <Link to="/" className={MENU_BUTTON}>
            <LogOut aria-hidden />
            Leave Game
          </Link>
        </div>
      </div>
    ) : null
    const board = (
      <div
        role="region"
        ref={setArea}
        aria-label="The table"
        className={`relative z-10 flex min-w-0 items-center justify-center ${scrolling ? 'shrink-0' : 'min-h-0 flex-1'}`}
      >
        {boardPanel}
      </div>
    )
    const pieces =
      'absolute inset-0 z-10 gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))]'
    return (
      <div
        data-game-id={game.id}
        data-seed={state.seed}
        data-table="text"
        {...holding}
        className="p03-screen crt fixed inset-0 z-50 overflow-hidden font-terminal text-xl"
      >
        {/* The screen and the glass stay put while the pieces scroll over them. */}
        <FaultyScreen />
        <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
        {sideways ? (
          <div
            className={`${pieces} grid grid-cols-[minmax(9.5rem,1fr)_auto_minmax(11.5rem,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden`}
          >
            <aside className="relative z-10 flex min-h-0 flex-col gap-2 overflow-hidden">
              <div className="rounded-md border-2 border-[#2f6b3d] bg-[#07130b] py-1 pr-1 pl-2">{status}</div>
              <Panel className="shrink-0 p-2">
                <Balance scale={view.scale} />
              </Panel>
              <section ref={setHandSection} aria-label="Your hand" className="flex min-h-0 flex-1 flex-col">
                {handCards}
              </section>
            </aside>
            {board}
            <aside className="relative z-10 flex min-h-0 flex-col gap-2">
              <div className="flex items-stretch gap-2">
                {pilesPanel}
                <div className="flex min-w-0 flex-1 flex-col">{executeButton}</div>
              </div>
              {says('min-h-0 flex-1')}
              {cancelButton}
            </aside>
          </div>
        ) : (
          <div className={`${pieces} flex flex-col ${scrolling ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            <div className="relative z-10 flex shrink-0 flex-col gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] py-1 pr-1 pl-2">
              {status}
              <ScaleBar scale={view.scale} fluid className="gap-1 pr-1 text-base" />
            </div>
            <div className="relative z-10 shrink-0">{says('h-[3.25rem] tall:h-[4.75rem]', 'hidden tall:block')}</div>
            {board}
            <section ref={setHandSection} aria-label="Your hand" className="relative z-10 flex shrink-0">
              {handCards}
            </section>
            <div className="relative z-10 flex shrink-0 items-stretch gap-2">
              {pilesPanel}
              <div className="flex min-w-0 flex-1 flex-col">{executeButton}</div>
              <div className="flex w-24 min-[360px]:w-28">{cancelButton}</div>
            </div>
          </div>
        )}
        {menuPanel}
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[85dvh] flex-col border-2 border-[#2f6b3d] bg-[#07130b] font-terminal text-p03 ring-0"
          >
            <DialogHeader>
              <DialogTitle className="font-terminal text-2xl font-normal text-p03">Battle log</DialogTitle>
            </DialogHeader>
            <ol ref={modalBox} onScroll={modalScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto text-lg">
              {logItems}
            </ol>
          </DialogContent>
        </Dialog>
        <Dialog open={readUnit !== null} onOpenChange={(open) => !open && setReading(null)}>
          <DialogContent
            aria-describedby={undefined}
            className="@container flex max-h-[85dvh] flex-col gap-2 overflow-y-auto border-2 border-[#0b1f12] bg-[#a9e7b8] p-3 pt-10 font-terminal text-[#0b1f12] ring-0 sm:max-w-sm"
          >
            <DialogTitle className="sr-only">{readUnit ? describe(readUnit) : 'Card'}</DialogTitle>
            {readUnit ? <ReaderBody unit={readUnit} /> : null}
            {readNote ? <p className="absolute top-2.5 right-10 left-3 truncate text-lg">{readNote}</p> : null}
          </DialogContent>
        </Dialog>
        <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
          <DialogContent
            aria-describedby={undefined}
            className="flex h-[min(32rem,85dvh)] flex-col overflow-hidden border-2 border-[#2f6b3d] bg-p03-ground p-0 ring-0 [&>[data-slot=dialog-close]]:z-10"
          >
            <DialogTitle className="sr-only">P03's terminal</DialogTitle>
            <Suspense fallback={<div className="h-full bg-p03-ground" />}>
              <Terminal lines={TERMINAL_LINES} user={user} />
            </Suspense>
          </DialogContent>
        </Dialog>
        {magnifier}
      </div>
    )
  }

  // Compact: a strip over the board, the playing pieces sized to fit the window, the rest below. Mid puts the
  // reader and the console beside the board; narrow, down to a 320px phone, stacks everything in one column.
  return (
    <div
      data-game-id={game.id}
      data-seed={state.seed}
      data-table="text"
      {...holding}
      className={`p03-screen crt mx-auto flex w-full max-w-[1792px] flex-col gap-2 overflow-hidden border border-[#2f6b3d] p-2 font-terminal text-xl sm:gap-3 sm:p-3 ${fullScreen.on ? 'fixed inset-0 z-50 overflow-y-auto' : 'relative rounded-lg'}`}
    >
      <FaultyScreen />
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
      {topStrip}
      <div ref={setArea} className="relative z-10 flex justify-center gap-3">
        <section aria-label="The table" className="flex flex-none flex-col items-center gap-2">
          {/* As wide as the board and no wider, so its words wrap instead of pushing the reader off the table. */}
          {seat && layout === 'narrow' ? (
            <div className="w-0 min-w-full">
              <SeatNote seat={seat} />
            </div>
          ) : null}
          {boardPanel}
        </section>
        {layout === 'mid' ? (
          // Pinned to the board's height so the column never makes the row taller; it takes the width left over.
          <div className="relative max-w-[32rem] min-w-52 flex-1">
            <div className="absolute inset-0 flex flex-col gap-3 overflow-hidden">
              {/* Here rather than over the board, where it would take the board's height. */}
              {seat ? <SeatNote seat={seat} /> : null}
              {readerPanel}
              {consolePanel}
            </div>
          </div>
        ) : null}
      </div>
      {/* The prompt over the hand and Cancel over the piles, in two columns so their edges line up. */}
      <section
        ref={setHandSection}
        aria-label="Your hand"
        className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2"
      >
        <div className="@container flex min-w-0 items-center">{promptLine}</div>
        {cancelButton}
        {handCards}
        {pilesPanel}
      </section>
      {layout === 'narrow' ? (
        <div className="relative z-10 flex flex-col gap-2">
          {flatReader}
          {consolePanel}
        </div>
      ) : null}
      <div className="relative z-10">{controlsPanel}</div>
      {magnifier}
    </div>
  )
}
