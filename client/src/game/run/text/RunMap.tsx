import { Eraser, PenLine, Undo2, X } from 'lucide-react'
import { animate, m, type AnimationPlaybackControls } from 'motion/react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { findNode, INTEGRITY, MAP_COLUMNS, reachable, type MapNode, type NodeKind, type StageMap } from 'shared'
import { mapRows, sideOf, spots, type Spot } from '../layout.ts'
import { NODE_ICONS, nodeIcon, nodeName } from '../nodes.ts'
import { usePlan } from '../plan.ts'
import type { Layout } from '../../text/useTextTable.ts'
import type { RunReady } from '../useRun.ts'
import link from './link.svg'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { IntegrityBar } from '../../controls.tsx'
import { fadeIn } from '../../moves.ts'
import { PenLayer } from './PenLayer.tsx'
import { ICON_BUTTON, ScreenActions, ScreenBar, useScreenMode } from './Screen.tsx'

type Mark = 'here' | 'visited' | 'next' | 'ahead' | 'behind' | 'cut'
type Link = 'taken' | 'open' | 'lit' | 'quiet'

// Opaque grounds, so the screen's moving text never shows through a node.
const STYLE: Record<Mark, string> = {
  here: 'border-p03 bg-[#13261a] text-p03',
  visited: 'border-p03-dim bg-[#0d1a10] text-p03-dim',
  next: 'border-p03 bg-p03-ground text-p03 hover:bg-[#13261a] focus-visible:bg-[#13261a]',
  ahead: 'border-p03-edge bg-p03-ground text-p03-dim',
  behind: 'border-p03-edge/50 bg-p03-ground text-p03-dim/60',
  // Ahead, but off every route from here.
  cut: 'border-p03-edge/40 bg-p03-ground text-p03-dim opacity-30',
}

/** The choice the pointer or focus is on: the node you'd go to, outlined in dashes. */
const AIMED = 'outline-2 outline-offset-4 outline-dashed outline-p03'

const LINK: Record<Link, string> = {
  taken: 'bg-p03-dim',
  open: 'bg-p03',
  lit: 'bg-p03',
  quiet: 'bg-p03-edge',
}

const WORDS: Partial<Record<Mark, string>> = {
  here: 'you are here',
  visited: 'visited',
  behind: 'passed by',
  cut: 'out of reach',
}

// Each row's share of the map's height, and the node's size: 44 pixels, the least a finger needs.
// A hologram sets --map-row so the whole stage fits its height.
const ROW_HEIGHT = 'var(--map-row, clamp(3.75rem, 9dvh, 5rem))'
const NODE = 44
/** How long a press must last to read a node instead of clicking it, in milliseconds. */
const HOLD_MS = 350
/** Stages whose map has already been shown scrolling down, this page load. */
const SURVEYED = new Set<string>()

const describeNext = (map: StageMap, node: MapNode) =>
  node.next.length
    ? `leads to ${node.next
        .map((id) => findNode(map, id))
        .filter((ahead): ahead is MapNode => Boolean(ahead))
        .map((ahead) => (ahead.kind === 'boss' ? nodeName(ahead) : `${nodeName(ahead)}, ${sideOf(ahead)}`))
        .join('; ')}`
    : ''

const KINDS = ['battle', 'card', 'campfire', 'stones', 'event', 'shop', 'item', 'boss'] as const

/** What each icon means; pointing at one lights every node of its kind, and choosing one keeps them lit. */
function Legend({
  shown,
  centered,
  onHover,
  onPick,
}: {
  shown: NodeKind | null
  centered: boolean
  onHover: (kind: NodeKind | null) => void
  onPick: (kind: NodeKind) => void
}) {
  const mode = useScreenMode()
  const terminal = mode === 'terminal'
  // In the projector's window, and on a phone, it's a row of icons named by tooltip and label, so it never covers the map.
  const hologram = mode === 'hologram'
  if (hologram || centered)
    return (
      <ul aria-label="What the icons mean" className={`flex gap-1 text-p03-dim ${centered ? 'justify-center' : ''}`}>
        {KINDS.map((kind) => {
          const Icon = NODE_ICONS[kind]
          return (
            <li key={kind}>
              <button
                type="button"
                aria-pressed={shown === kind}
                aria-label={nodeName({ kind })}
                title={nodeName({ kind })}
                onClick={() => onPick(kind)}
                onPointerEnter={() => onHover(kind)}
                onPointerLeave={() => onHover(null)}
                className={`grid place-items-center rounded-sm hover:text-p03 hover:[filter:drop-shadow(0_0_6px_rgb(125_255_154/0.9))] focus-visible:outline-2 focus-visible:outline-p03 aria-pressed:text-p03 aria-pressed:outline-1 aria-pressed:outline-p03 ${hologram ? 'size-6' : 'size-9'}`}
              >
                <Icon aria-hidden className={hologram ? 'size-4' : 'size-5'} />
              </button>
            </li>
          )
        })}
      </ul>
    )
  return (
    <ul
      aria-label="What the icons mean"
      className={`flex flex-wrap gap-1 text-base text-p03-dim ${centered ? 'justify-center' : ''}`}
    >
      {KINDS.map((kind) => {
        const Icon = NODE_ICONS[kind]
        return (
          <li key={kind}>
            <button
              type="button"
              aria-pressed={shown === kind}
              onClick={() => onPick(kind)}
              onPointerEnter={() => onHover(kind)}
              onPointerLeave={() => onHover(null)}
              className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:text-p03 focus-visible:outline-2 focus-visible:outline-p03 aria-pressed:text-p03 ${
                // Over the 3D table nothing gets a ground, so the room shows through; the light brightens instead.
                terminal
                  ? 'hover:bg-[#13261a] aria-pressed:bg-[#13261a]'
                  : 'hover:[text-shadow:0_0_8px_rgb(125_255_154/0.9)] aria-pressed:underline aria-pressed:underline-offset-4 aria-pressed:[text-shadow:0_0_8px_rgb(125_255_154/0.9)]'
              }`}
            >
              <Icon aria-hidden className="size-4" />
              {nodeName({ kind })}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The stage's map: nodes nudged off a grid, the links between them, and a pen for planning a route. */
export function RunMap({ run, layout }: { run: RunReady; layout: Layout }) {
  const { state, path } = run
  const [peek, setPeek] = useState<string | null>(null)
  // Holding a node shows it larger with its name, for touch and for anyone not hovering; the release then isn't a click.
  const [held, setHeld] = useState<string | null>(null)
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false })
  useEffect(() => () => clearTimeout(hold.current.timer), [])
  const holdProps = (id: string) => ({
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.button !== 0) return
      clearTimeout(hold.current.timer)
      hold.current.fired = false
      hold.current.timer = setTimeout(() => {
        hold.current.fired = true
        setHeld(id)
      }, HOLD_MS)
    },
    onPointerUp: () => {
      clearTimeout(hold.current.timer)
      setHeld(null)
    },
    onPointerLeave: () => {
      clearTimeout(hold.current.timer)
      setHeld(null)
    },
    onPointerCancel: () => {
      clearTimeout(hold.current.timer)
      setHeld(null)
    },
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
  })
  const [pen, setPen] = useState(false)
  const [hovered, setHovered] = useState<NodeKind | null>(null)
  const [picked, setPicked] = useState<NodeKind | null>(null)
  const shown = hovered ?? picked
  const { plan, addStroke, undo, toggleMark, clear } = usePlan(state.seed, state.stage)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  // Brings the next choice into view, since a tall map scrolls inside its frame.
  const here = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = here.current
    const scroller = node?.closest<HTMLElement>('[data-scroller]')
    if (!node || !scroller) return
    // Only the frame's own scroller moves, never the page.
    const offset = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    const target = scroller.scrollTop + offset - scroller.clientHeight / 2
    const key = `${state.seed}:${state.stage}`
    if (SURVEYED.has(key) || prefersReducedMotion()) {
      scroller.scrollTop = target
      return
    }
    // A stage's map first shows from the top, then travels down as far as it can with the next choice still in view.
    const top = scroller.scrollTop + offset
    scroller.scrollTop = 0
    const distance = Math.min(top - NODE * 1.5, scroller.scrollHeight - scroller.clientHeight)
    if (distance <= 0) return
    let glide: AnimationPlaybackControls | undefined
    const delay = setTimeout(() => {
      SURVEYED.add(key)
      glide = animate(0, distance, {
        duration: Math.min(1.6, Math.max(0.7, distance * 0.0014)),
        ease: [0.65, 0, 0.35, 1],
        onUpdate: (top) => (scroller.scrollTop = top),
      })
    }, 350)
    // The player's own scroll takes over, as does a press, so a stroke or a click never lands on a moving map.
    const stop = () => {
      clearTimeout(delay)
      glide?.stop()
    }
    scroller.addEventListener('wheel', stop, { passive: true })
    scroller.addEventListener('touchstart', stop, { passive: true })
    scroller.addEventListener('pointerdown', stop)
    return () => {
      stop()
      scroller.removeEventListener('wheel', stop)
      scroller.removeEventListener('touchstart', stop)
      scroller.removeEventListener('pointerdown', stop)
    }
  }, [state.seed, state.stage])

  // Neighbors never come closer than this many pixels, so the path between them always shows.
  const gap = 22
  const cell = { x: size.width / MAP_COLUMNS, y: size.height / mapRows(state.map) }
  // Nodes shrink on a short map rather than crowd, down to what still reads.
  const nodeSize = Math.round(Math.max(28, Math.min(NODE, cell.y - gap, cell.x - gap)))
  const room = (span: number) => (span ? Math.max(0, (span - nodeSize - gap) / 2 / span) : 0)
  const placed = spots(state.map, state.seed, { x: room(cell.x), y: room(cell.y) })
  const open = reachable(state)
  const row = state.at === null ? -1 : (findNode(state.map, state.at)?.row ?? -1)
  // Every node still on a route from here; the rest ahead are out of reach.
  const ahead = new Set<string>()
  const walk = [...open]
  while (walk.length) {
    const id = walk.pop() as string
    if (ahead.has(id)) continue
    ahead.add(id)
    walk.push(...(findNode(state.map, id)?.next ?? []))
  }
  const markOf = (node: MapNode): Mark =>
    node.id === state.at
      ? 'here'
      : path.includes(node.id)
        ? 'visited'
        : open.includes(node.id)
          ? 'next'
          : node.row <= row
            ? 'behind'
            : ahead.has(node.id)
              ? 'ahead'
              : 'cut'
  const linkOf = (from: MapNode, to: string): Link => {
    const step = path.indexOf(from.id)
    if (step >= 0 && path[step + 1] === to) return 'taken'
    // Pointing at a choice lights only the step to it, not the steps beyond, which would look like the way taken.
    if (from.id === state.at && to === peek && open.includes(to)) return 'lit'
    if (from.id === state.at && open.includes(to)) return 'open'
    return 'quiet'
  }
  const at = (spot: Spot) => ({ x: spot.x * size.width, y: spot.y * size.height })
  // A stroke that passes through a node marks it as planned.
  const inked = new Set<string>()
  for (const node of state.map.rows.flat()) {
    const center = at(placed.get(node.id) as Spot)
    const reach = (node.kind === 'boss' ? nodeSize * 0.75 : nodeSize / 2) + 4
    const hit = plan.strokes.some((stroke) => {
      for (let index = 0; index < stroke.length; index += 2) {
        const dx = (stroke[index] as number) * size.width - center.x
        const dy = (stroke[index + 1] as number) * size.height - center.y
        if (dx * dx + dy * dy <= reach * reach) return true
      }
      return false
    })
    if (hit) inked.add(node.id)
  }
  const choices = open.map((id) => findNode(state.map, id)).filter((node): node is MapNode => Boolean(node))
  const last = state.map.rows.length - 1

  const hologram = useScreenMode() === 'hologram'
  const legend = (
    <Legend
      shown={shown}
      // Centered on a phone, upright or on its side.
      centered={layout === 'phone'}
      onHover={setHovered}
      onPick={(kind) => setPicked((now) => (now === kind ? null : kind))}
    />
  )
  return (
    <div className="flex flex-col gap-3">
      {/* The pen beside the menu, and the legend above the map, so both stay in reach while it scrolls. */}
      <ScreenActions>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={pen}
            onClick={() => setPen((on) => !on)}
            aria-label="Plan a route"
            title="Plan a route: draw on the map, and the nodes you pass through are marked"
            className={ICON_BUTTON}
          >
            <PenLine aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!plan.strokes.length}
            aria-label="Undo the last stroke"
            title="Undo the last stroke"
            className={`${ICON_BUTTON} disabled:opacity-40`}
          >
            <Undo2 aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!plan.strokes.length && !plan.marks.length}
            aria-label="Clear the plan"
            title="Clear the plan"
            className={`${ICON_BUTTON} disabled:opacity-40`}
          >
            <Eraser aria-hidden className="size-5" />
          </button>
        </div>
      </ScreenActions>
      <ScreenBar>
        {/* The tools carried and the bytes banked are in the inventory; only integrity, which ends runs, shows here. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pb-1">
          <IntegrityBar left={state.integrity} max={INTEGRITY} compact className="gap-1 text-lg" />
          {legend}
        </div>
      </ScreenBar>
      {/* Padded, so the boss and the first row are never cut off at the top or bottom of the scroll. */}
      <div className={hologram ? 'py-5' : 'py-8'}>
        <div ref={box} className="relative w-full" style={{ height: `calc(${ROW_HEIGHT} * ${mapRows(state.map)})` }}>
          {/* The links: one image tiled along each, turned to point at the node ahead. */}
          <div aria-hidden className="absolute inset-0">
            {size.width
              ? state.map.rows.flat().flatMap((node) =>
                  node.next.map((id) => {
                    const from = at(placed.get(node.id) as Spot)
                    const to = at(placed.get(id) as Spot)
                    const length = Math.hypot(to.x - from.x, to.y - from.y)
                    const angle = Math.atan2(to.y - from.y, to.x - from.x)
                    const style: CSSProperties = {
                      left: from.x,
                      top: from.y - 2,
                      width: length,
                      transform: `rotate(${angle}rad)`,
                      maskImage: `url("${link}")`,
                      maskRepeat: 'repeat-x',
                    }
                    return (
                      <span
                        key={`${node.id}>${id}`}
                        style={style}
                        className={`absolute h-1 origin-left ${LINK[linkOf(node, id)]}`}
                      />
                    )
                  }),
                )
              : null}
          </div>
          <PenLayer active={pen} strokes={plan.strokes} width={size.width} height={size.height} onStroke={addStroke} />
          {/* In reading order from the start; placed with the boss at the top, as the run climbs toward it. */}
          <ol aria-label="The map, from the start to the boss">
            {state.map.rows.map((nodes, index) => (
              <li key={index}>
                <span className="sr-only">{index === last ? 'The boss:' : `Step ${index + 1}:`}</span>
                <ul>
                  {nodes.map((node) => {
                    const mark = markOf(node)
                    const planned = inked.has(node.id) || plan.marks.includes(node.id)
                    const spot = placed.get(node.id) as Spot
                    const Icon = nodeIcon(node)
                    const name = `${nodeName(node)}${node.kind === 'boss' ? '' : `, ${sideOf(node)}`}`
                    const words = [WORDS[mark], planned ? 'planned' : '', describeNext(state.map, node)].filter(Boolean)
                    const label = `${name}${words.length ? `, ${words.join(', ')}` : ''}`
                    const boss = node.kind === 'boss'
                    const box = `absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border-2 ${STYLE[mark]} ${planned ? 'ring-2 ring-[#ffb347] ring-offset-2 ring-offset-p03-ground' : ''} ${peek === node.id && mark === 'next' ? AIMED : shown === node.kind ? 'shadow-[0_0_14px_rgb(125_255_154/0.75)] outline-2 outline-offset-4 outline-p03' : ''}`
                    const style = {
                      left: `${spot.x * 100}%`,
                      top: `${spot.y * 100}%`,
                      width: boss ? nodeSize * 1.5 : nodeSize,
                      height: boss ? nodeSize * 1.5 : nodeSize,
                    }
                    // The icon keeps its share of the node, so a small node keeps its padding.
                    const icon = Math.round(nodeSize * (boss ? 0.8 : 0.55))
                    // A node already gone to is crossed out, as Inscryption's maps do, its icon dimmed beneath.
                    const gone = mark === 'visited' || mark === 'here'
                    const face = (
                      <>
                        <Icon aria-hidden style={{ width: icon, height: icon }} className={gone ? 'opacity-25' : ''} />
                        {/* Lucide's X spans the middle half of its box, so twice the node's size takes it to the corners. */}
                        {gone ? (
                          <X
                            aria-hidden
                            strokeWidth={1.5}
                            className="pointer-events-none absolute top-1/2 left-1/2 size-[190%] -translate-1/2"
                          />
                        ) : null}
                      </>
                    )
                    const reading =
                      held === node.id ? (
                        <m.span
                          aria-hidden
                          {...fadeIn(0.12)}
                          style={{ left: style.left, top: style.top }}
                          // Centered on its node, unless that would run it off a side of the frame.
                          className={`pointer-events-none absolute z-40 flex ${spot.x < 0.25 ? '-translate-x-6' : spot.x > 0.75 ? '-translate-x-[calc(100%-1.5rem)]' : '-translate-x-1/2'} ${spot.y < 0.3 ? 'translate-y-9' : '-translate-y-[calc(100%+2.25rem)]'} flex-col items-center gap-1 rounded-md border-2 border-p03 bg-p03-ground px-3 py-2 text-center whitespace-nowrap text-p03 shadow-[0_0_18px_rgb(125_255_154/0.5)]`}
                        >
                          <Icon className="size-10" />
                          <span className="text-xl">{nodeName(node)}</span>
                          {WORDS[mark] ? <span className="text-base text-p03-dim">{WORDS[mark]}</span> : null}
                        </m.span>
                      ) : null
                    // With the pen on, every node marks the plan; otherwise only the ones in reach are buttons.
                    if (pen || mark === 'next')
                      return (
                        <li key={node.id}>
                          <button
                            ref={mark === 'next' ? (element) => void (here.current ??= element) : undefined}
                            type="button"
                            {...(pen ? { 'aria-pressed': planned } : { 'data-action': 'go', 'data-node': node.id })}
                            aria-label={label}
                            title={nodeName(node)}
                            onClick={() => {
                              // A press long enough to read the node isn't a click on it.
                              if (hold.current.fired) return void (hold.current.fired = false)
                              if (pen) toggleMark(node.id)
                              else run.act({ type: 'go', node: node.id })
                            }}
                            {...holdProps(node.id)}
                            onPointerEnter={() => setPeek(node.id)}
                            onPointerLeave={() => {
                              setPeek(null)
                              holdProps(node.id).onPointerLeave()
                            }}
                            onFocus={() => setPeek(node.id)}
                            onBlur={() => setPeek(null)}
                            style={style}
                            data-planned={planned || undefined}
                            className={`${box} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03`}
                          >
                            {face}
                          </button>
                          {reading}
                        </li>
                      )
                    return (
                      <li key={node.id}>
                        <span
                          title={nodeName(node)}
                          style={style}
                          data-planned={planned || undefined}
                          className={`${box} touch-manipulation select-none`}
                          {...holdProps(node.id)}
                        >
                          {face}
                          <span className="sr-only">{label}</span>
                        </span>
                        {reading}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="sr-only">
        {choices.length
          ? `From here: ${choices.map((node) => `${nodeName(node)} (${sideOf(node)})`).join(' or ')}.`
          : 'Nowhere to go from here.'}
      </p>
    </div>
  )
}
