import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { card, legalActions, SIGILS, TIP, type Action, type SigilId, type Slot, type Unit } from 'shared'
import { DemoNote, describe, GameOver, has, laneAction, owed, prompt, scaleWords, WalkAway } from './controls.tsx'
import { ICONS, STAT_ICONS } from './table/faces.ts'
import type { Playback } from './table/playback.ts'
import { usePlayback } from './table/usePlayback.ts'
import { Circuit } from './Circuit.tsx'
import { useFullScreen } from './fullScreen.ts'
import type { Ready } from './useGame.ts'

// The text table laid out as Inscryption's Act 2, in P03's green: the scale and the button on the left, the board in
// the middle, the card being looked at on the right, and the hand along the bottom.
const INK = '#0b1f12'

/** A card's 2022 art in ink: the drawing is ink on a clear ground, so it serves as a mask, sharp at any size. */
function Art({ id, big = false }: { id: string; big?: boolean }) {
  if (id === 'Boilerplate') return <span className={big ? 'text-4xl' : 'text-[15cqw]'}>{'<div>'}</span>
  return (
    <span
      aria-hidden
      className="block h-[92%] w-[92%] bg-[#0b1f12]"
      style={{
        maskImage: `url(/cards/${id}.png)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}

/** One of the sigils' pixel icons, or the sword or the shield. */
function Sigil({
  id,
  size = 18,
  colour = INK,
}: {
  id: SigilId | keyof typeof STAT_ICONS
  /** Pixels, or any CSS length, such as em to follow the text beside it. */
  size?: number | string
  colour?: string
}) {
  const grid = id === 'attack' || id === 'health' ? STAT_ICONS[id] : ICONS[id]
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {grid.flatMap((row, y) =>
        [...row].map((bit, x) =>
          bit === '1' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={colour} /> : null,
        ),
      )}
    </svg>
  )
}

/**
 * A card as Act 2 draws it, shaped loosely like the 3D table's floppy disks: a clipped corner and a steel shutter at
 * the top, the art below it, sigils under that, the cost in the corner and attack and health at the foot.
 */
function PixelCard({ unit, big = false }: { unit: Unit; big?: boolean }) {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  return (
    <span
      // Its print is sized from its own width, so a small card on a short window stays legible.
      className={`@container relative flex aspect-[4/5] w-full flex-col overflow-hidden text-[#0b1f12] [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)] ${rare ? 'bg-[#f3c6c0]' : 'bg-[#a9e7b8]'} bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.07)_0_1px,transparent_1px_3px)]`}
    >
      {/* The shutter, and its window. */}
      <span aria-hidden className="absolute top-0 left-[22%] z-10 h-[9%] w-[46%] rounded-b-sm bg-[#b9c3c8]">
        <span className="absolute top-[18%] right-[16%] h-[62%] w-[20%] bg-[#0b1f12]" />
      </span>
      <span
        className={`relative mx-[6%] mt-[16%] flex flex-[1.3] items-center justify-center border-2 border-[#0b1f12]/70 ${rare ? 'bg-[#e8aea8]' : 'bg-[#8fd3a0]'}`}
      >
        <Art id={unit.card} big={big} />
        {def.cost ? (
          <span className="absolute top-[4cqw] right-[4cqw] flex gap-[2cqw]" aria-hidden>
            {[...Array(def.cost).keys()].map((i) => (
              <span key={i} className="size-[7cqw] bg-[#ff9a2e] outline outline-1 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 items-center justify-center gap-1">
        {unit.sigils.map((sigil) => (
          <Sigil key={sigil} id={sigil} size="20cqw" />
        ))}
      </span>
      <span className="flex justify-between px-[5cqw] pb-[2cqw] text-[21cqw] leading-none">
        <span className="flex items-center gap-[2cqw]">
          <Sigil id="attack" size="0.5em" />
          {unit.attack}
        </span>
        <span className={`flex items-center gap-[2cqw] ${unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}`}>
          {unit.health}
          <Sigil id="health" size="0.5em" />
        </span>
      </span>
    </span>
  )
}

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
      <svg viewBox="0 0 200 150" className="max-h-[15dvh] w-full" shapeRendering="crispEdges" aria-hidden>
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
  'rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 font-terminal text-lg text-p03 hover:bg-[#13261a] hover:text-p03 dark:hover:bg-[#13261a]'

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 ${className}`}>{children}</div>
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
function useLaneSize() {
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState(96)
  useEffect(() => {
    if (!area) return
    const fit = () => {
      // The panel's padding and border, the gaps between lanes, and the line between P03's rows and the player's.
      const width = (area.clientWidth - 28 - 3 * 8) / 4
      const height = ((area.clientHeight - 28 - 3 * 8 - 2) / 3) * 0.8
      setSize(Math.max(48, Math.floor(Math.min(width, height))))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(area)
    return () => observer.disconnect()
  }, [area])
  return { setArea, lane: { width: size, height: size * 1.25 } }
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
      const height = Math.max(480, Math.min(room, width * MOST_TALL))
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

/** P03's idle process monitor, filling the space under the button: names, load bars and a blinking cursor. */
function Processes() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 900)
    return () => clearInterval(timer)
  }, [])
  // A steady wander rather than noise, from the tick, so it reads as work being done.
  const load = (i: number) =>
    Math.round(4 + 4 * (1 + Math.sin(tick * 0.7 + i * 1.9)) * (0.5 + 0.5 * Math.cos(tick * 0.23 + i)))
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2 text-base text-p03-dim"
    >
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
  )
}

/** The text table laid out as Act 2: a whole game through its buttons, played back one move at a time. */
export function TerminalTable({
  game,
  onDemo,
  on3d,
  onClassic,
}: {
  game: Ready
  onDemo: boolean
  on3d: () => void
  onClassic: () => void
}) {
  const { state, act, result } = game
  // The page shows the game as far as its playback has reached; moves come from the real state, and wait for it.
  const { playback, busy } = usePlayback(game)
  const view = playback.view
  const legal = busy || result ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  // Where the pointer is, not the card that was there: a card played into that lane shows at once.
  const [looking, setLooking] = useState<Place | null>(null)
  const fullScreen = useFullScreen()
  const { frame, size } = useFit(fullScreen.on)
  const pointedAt = !looking
    ? null
    : 'uid' in looking
      ? (view.hand.find((unit) => unit.uid === looking.uid) ?? null)
      : (view[looking.row][looking.lane] ?? null)
  const inspected = pointedAt ?? summoning ?? null
  const look = (place: Place) => ({
    onPointerEnter: () => setLooking(place),
    onPointerLeave: () => setLooking(null),
    onFocus: () => setLooking(place),
    onBlur: () => setLooking(null),
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

  // A lane's size comes from the board's height, so the whole table fits the window.
  const { setArea, lane: laneSize } = useLaneSize()
  const cell = 'flex shrink-0 items-center justify-center rounded-md border-2 p-1'
  const faces = playback.popups.filter((popup) => 'face' in popup.spot)
  const over = result && !busy

  return (
    <>
      {/* In full screen, the page behind the table goes dark. */}
      {fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
      <div
        data-game-id={game.id}
        data-seed={state.seed}
        data-table="text"
        ref={frame}
        // Sized to the room it has, in the page or the whole screen; the classes never fight over position or size.
        style={size}
        className={`p03-screen crt grid grid-cols-[17rem_minmax(0,1fr)_22rem] grid-rows-[minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-lg border border-[#2f6b3d] p-4 font-terminal text-2xl ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`}
      >
        {/* The glass over it all: scanlines with a band rolling down, dark corners, and a rare flicker. */}
        <Circuit />
        <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
        <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
          <Panel className="flex items-center justify-between text-2xl">
            <span className="text-p03">Turn {view.turn}</span>
            <span className="text-base text-p03-dim" aria-live="polite">
              {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
            </span>
          </Panel>
          <Panel>
            <Balance scale={view.scale} />
          </Panel>
          <button
            type="button"
            data-action="ringBell"
            disabled={!canPress}
            onClick={() => act({ type: 'ringBell' })}
            aria-keyshortcuts="E"
            aria-label="Press the button"
            className="flex flex-col items-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 text-p03 enabled:hover:bg-[#13261a] disabled:[&>*]:opacity-40"
          >
            <span className="grid size-[min(3.5rem,6dvh)] place-items-center rounded-full border-4 border-[#2f6b3d] bg-[#a3172b] shadow-[0_0_14px_rgb(255_60_60/0.4)]" />
            <span className="text-2xl tracking-widest">EXECUTE</span>
            <span className="text-sm text-p03-dim [@media(max-height:780px)]:hidden">press the button · E</span>
          </button>
          <Processes />
        </aside>

        <section aria-label="The table" className="relative z-10 flex min-h-0 flex-col items-center gap-2">
          {onDemo ? <DemoNote /> : null}
          <div ref={setArea} className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Panel className="relative flex flex-col gap-2">
              {/* P03's face above the board and the player's below it, where hits to either land. */}
              {faces.map((popup) => (
                <Rising
                  key={popup.id}
                  text={popup.text}
                  tone={popup.tone}
                  className={
                    'face' in popup.spot && popup.spot.face === 'opponent' ? 'top-0 left-1/2' : 'top-full left-1/2'
                  }
                />
              ))}
              <div className="flex justify-center gap-2" aria-label="P03's queue">
                {view.back.map((unit, i) => (
                  <div
                    key={i}
                    {...look({ row: 'back', lane: i })}
                    aria-label={unit ? `Queued in lane ${i + 1}: ${describe(unit)}` : `Lane ${i + 1}: nothing queued`}
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
              <div className="flex justify-center gap-2" aria-label="P03's row">
                {view.front.map((unit, i) => (
                  <div
                    key={i}
                    {...look({ row: 'front', lane: i })}
                    aria-label={unit ? `P03's lane ${i + 1}: ${describe(unit)}` : `P03's lane ${i + 1}: empty`}
                    className={`${cell} border-[#1f3a26]`}
                    style={laneSize}
                  >
                    <Occupant row="front" lane={i} unit={unit} playback={playback} fresh={fresh} />
                  </div>
                ))}
              </div>
              <div className="border-t-2 border-death/50" />
              <div className="flex justify-center gap-2" aria-label="Your row">
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
                            <span className="grid size-full place-items-center text-base text-p03-dim">play here</span>
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
                      {...look({ row: 'board', lane: i })}
                      onClick={action ? undefined : () => !busy && refuse(`lane-${i}`)}
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
          </div>
          <p
            key={refused.count}
            className="text-p03-dim"
            style={refused.count ? { animation: 'nudge 0.6s ease-out' } : undefined}
          >
            {busy
              ? "P03's turn…"
              : prompt(
                  mustDraw,
                  summoning,
                  summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0,
                )}
          </p>
        </section>

        <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
          <Panel className="flex min-h-0 flex-1 flex-col gap-2 bg-[#a9e7b8] text-[#0b1f12]">
            {inspected ? (
              <>
                <p className="flex items-start justify-between gap-2 text-3xl leading-none">
                  <span>{card(inspected.card).name}</span>
                  {card(inspected.card).cost ? (
                    <span className="shrink-0 text-lg">x{card(inspected.card).cost}</span>
                  ) : null}
                </p>
                {/* The art large and the stats under it, as Act 2's inspector shows a card. */}
                <div className="grid min-h-0 flex-[1.4] place-items-center rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]">
                  <Art id={inspected.card} big />
                </div>
                {/* A fixed height, with the sigils scrolling inside it, so reading a card never moves the page. */}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {inspected.sigils.length ? (
                    inspected.sigils.map((sigil) => (
                      <p key={sigil} className="flex gap-2 text-xl leading-tight">
                        <span className="shrink-0 pt-0.5">
                          <Sigil id={sigil} size={20} />
                        </span>
                        <span>
                          <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="text-lg">No sigils.</p>
                  )}
                </div>
                <p className="flex shrink-0 justify-between border-t-2 border-[#0b1f12]/40 pt-1 text-3xl">
                  <span aria-label={`Attack ${inspected.attack}`} className="flex items-center gap-1">
                    <Sigil id="attack" size={20} />
                    {inspected.attack}
                  </span>
                  <span
                    aria-label={`Health ${inspected.health}`}
                    className={`flex items-center gap-1 ${inspected.health < inspected.maxHealth ? 'text-[#a3172b]' : ''}`}
                  >
                    {inspected.health}
                    <Sigil id="health" size={20} />
                  </span>
                </p>
              </>
            ) : (
              <p className="text-lg leading-snug">Point at a card to read it.</p>
            )}
          </Panel>
          <section
            aria-label="P03's console"
            className="rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 text-base"
          >
            <ol aria-live="polite" className="flex h-36 flex-col-reverse overflow-y-auto text-lg">
              {[...game.log].reverse().map((line, index) => (
                <li key={game.log.length - index}>{line}</li>
              ))}
            </ol>
          </section>
          {/* Always in its place, shown only while summoning, so nothing moves when it comes and goes. */}
          <button
            type="button"
            {...(state.summon ? { 'data-action': 'cancel' } : { 'aria-hidden': true, tabIndex: -1 })}
            disabled={!state.summon}
            onClick={() => act({ type: 'cancel' })}
            className={`${SIDE_BUTTON} ${state.summon ? '' : 'invisible'}`}
          >
            Cancel
          </button>
        </aside>

        <section
          aria-label="Your hand"
          className="relative z-10 col-span-3 flex h-[clamp(8rem,19dvh,13rem)] items-end gap-4 border-t-2 border-[#2f6b3d] pt-3"
        >
          {/* The table's own controls, in the hand row's spare room on the left, so the left column never runs out. */}
          <div className="flex w-[17rem] shrink-0 flex-col justify-end gap-2 self-stretch">
            <div className="flex gap-2">
              {fullScreen.supported ? (
                <button type="button" onClick={fullScreen.toggle} className={`${SIDE_BUTTON} flex-1 whitespace-nowrap`}>
                  {fullScreen.on ? 'Exit full screen' : 'Full screen'}
                </button>
              ) : null}
              <WalkAway forfeit={game.forfeit} className={`${SIDE_BUTTON} h-auto flex-1 justify-center`} />
            </div>
            <div className="flex justify-between font-sans text-sm text-p03-dim">
              <button type="button" onClick={on3d} className="underline hover:text-p03">
                Play on the 3D table
              </button>
              <button type="button" onClick={onClassic} className="underline hover:text-p03">
                First text table
              </button>
            </div>
          </div>
          <div className="flex h-full min-w-0 flex-1 justify-center gap-2">
            {view.hand.map((unit) => {
              const selected = unit.uid === state.summon?.uid
              const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
              return (
                // The pointer is watched here, and the button is never disabled, so every card can be read and a card
                // that cannot be played yet can say so by shaking.
                <div
                  key={unit.uid}
                  {...look({ uid: unit.uid })}
                  className="aspect-[4/5] h-full shrink"
                  style={fresh(unit.uid) ? { animation: 'arrive-up 280ms ease-out' } : undefined}
                >
                  <button
                    type="button"
                    aria-disabled={!allowed && !selected}
                    aria-pressed={selected}
                    aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
                    data-action="select"
                    data-uid={unit.uid}
                    onClick={() =>
                      allowed
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
          <div key={refused.count} className="flex shrink-0 gap-3" style={shaking('piles')}>
            <button
              type="button"
              data-action="draw-deck"
              disabled={!mustDraw}
              onClick={() => act({ type: 'draw', from: 'deck' })}
              aria-label={`Draw from the deck, ${view.deck} left`}
              className="flex w-20 flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50"
            >
              <span className="grid aspect-[4/5] w-full place-items-center rounded-md border-2 border-[#2f6b3d] bg-[#0b1f12] text-3xl shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
                ▦
              </span>
              <span className="text-lg">x{view.deck}</span>
            </button>
            <button
              type="button"
              data-action="draw-boilerplate"
              disabled={!mustDraw}
              onClick={() => act({ type: 'draw', from: 'boilerplate' })}
              aria-label="Take a Boilerplate"
              className="flex w-20 flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50"
            >
              <span className="grid aspect-[4/5] w-full place-items-center rounded-md border-2 border-[#0b1f12] bg-[#a9e7b8] text-lg text-[#0b1f12] shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
                {'</>'}
              </span>
              <span className="text-lg">∞</span>
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
