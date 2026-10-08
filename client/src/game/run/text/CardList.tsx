import { ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'
import { Rising } from '../../text/Board.tsx'
import { CardReader, SigilIcons, useCardSearch } from './CardBits.tsx'

type Props = {
  units: Unit[]
  /** Without it the cards are only shown, not chosen. */
  onPick?: (unit: Unit) => void
  /** Data attributes for each card's button, for tests to find them. */
  data?: (unit: Unit) => Record<string, string | number>
  can?: (unit: Unit) => boolean
  picked?: number | null
  /** Several cards chosen at once, as a merge request's pair is. */
  chosen?: number[]
  /** A class for each card's place, such as an entrance. */
  itemClass?: string
  /** Each card's sigils spelled out beneath it, for a choice where they matter. */
  detail?: boolean
  size?: string
  /** Narrowed by the screen's search, the one in the deck beside it or above the cards. */
  filtered?: boolean
  /** A card that just changed: it pops, with `text` rising over it; a new `key` plays it again. */
  flash?: { uid: number; key: number; text: string }
}

function Caption({ unit, detail, onRead }: { unit: Unit; detail: boolean; onRead: () => void }) {
  const name = card(unit.card).name
  return (
    <span className="flex min-w-0 flex-col gap-1 text-left leading-tight">
      <span className="flex min-w-0 items-center gap-1">
        {/* One line, cut short; the magnifier opens the whole card. */}
        <span title={name} className="min-w-0 flex-1 truncate text-lg text-p03">
          {name}
        </span>
        <button
          type="button"
          onClick={onRead}
          aria-label={`Read ${name}`}
          title="Read the whole card"
          className="grid size-7 shrink-0 place-items-center rounded-sm text-p03-dim hover:bg-[#13261a] hover:text-p03 focus-visible:outline-2 focus-visible:outline-p03"
        >
          <ZoomIn aria-hidden className="size-4" />
        </button>
      </span>
      {detail ? (
        unit.sigils.map((sigil) => (
          <span key={sigil} className="font-sans text-sm text-foreground">
            <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
          </span>
        ))
      ) : (
        <SigilIcons sigils={unit.sigils} size={14} />
      )}
    </span>
  )
}

/** A row of cards that wraps, each with its name; buttons when they can be chosen. */
export function CardList({
  units,
  onPick,
  data,
  can = () => true,
  picked = null,
  chosen: several,
  itemClass = '',
  detail = false,
  size = 'w-28',
  filtered = false,
  flash,
}: Props) {
  const [reading, setReading] = useState<Unit | null>(null)
  const hold = useHoldToRead(setReading)
  const { matches } = useCardSearch()
  const shown = filtered ? units.filter(matches) : units
  return (
    <div className="flex flex-col gap-3">
      {/* Room above, so a chosen card's lift and outline aren't cut off by the top of the scroll. */}
      <ul className="flex flex-wrap justify-center gap-4 pt-3">
        {shown.map((unit) => {
          const allowed = can(unit)
          const chosen = picked === unit.uid || Boolean(several?.includes(unit.uid))
          const flashed = flash?.uid === unit.uid ? flash : undefined
          const face = flashed ? (
            <span key={flashed.key} className="relative block motion-safe:animate-[warm-pop_650ms_ease-out]">
              <PixelCard unit={unit} />
              {/* The rise animation centers the text on this point itself. */}
              <Rising text={flashed.text} tone="note" className="top-1/3 left-1/2 text-2xl" />
            </span>
          ) : (
            <PixelCard unit={unit} />
          )
          return (
            <li key={unit.uid} className={`flex shrink-0 flex-col gap-2 ${size} ${itemClass}`}>
              {onPick ? (
                <button
                  type="button"
                  {...data?.(unit)}
                  disabled={!allowed}
                  aria-pressed={picked === null && !several ? undefined : chosen}
                  aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
                  {...hold.props(unit)}
                  onClick={() => !hold.read() && onPick(unit)}
                  className={`rounded-md p-1 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 disabled:brightness-50 disabled:saturate-50 motion-reduce:transition-none ${chosen ? '-translate-y-2 outline-2 outline-p03 outline-dashed' : 'enabled:hover:-translate-y-1'}`}
                >
                  {face}
                </button>
              ) : (
                <div className="touch-none p-1 select-none" {...hold.props(unit)}>
                  {face}
                </div>
              )}
              <Caption unit={unit} detail={detail} onRead={() => setReading(unit)} />
            </li>
          )
        })}
      </ul>
      {shown.length ? null : <p className="text-center text-lg text-p03-dim">No card matches.</p>}
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </div>
  )
}

/** How long a press must last to read the card instead of choosing it, in milliseconds, as an item's button has it. */
const HOLD_MS = 350

/** Holding a card opens it to read; letting go after a hold isn't a click. */
export function useHoldToRead(open: (unit: Unit) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const held = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stop = () => clearTimeout(timer.current)
  return {
    props: (unit: Unit) => ({
      onPointerDown: (event: PointerEvent) => {
        if (event.button !== 0) return
        held.current = false
        stop()
        timer.current = setTimeout(() => {
          held.current = true
          open(unit)
        }, HOLD_MS)
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
    }),
    /** Whether the press just ended was a hold, which then isn't counted again. */
    read: () => {
      const was = held.current
      held.current = false
      return was
    },
  }
}

/** A card shown, not chosen, that still opens to read when held or clicked, as every card on these screens can. */
export function ReadableCard({
  unit,
  blank,
  label,
}: {
  unit: Unit
  blank?: Parameters<typeof PixelCard>[0]['blank']
  label?: string
}) {
  const [reading, setReading] = useState<Unit | null>(null)
  const hold = useHoldToRead(setReading)
  return (
    <>
      <button
        type="button"
        aria-label={label ?? `Read ${card(unit.card).name}`}
        {...hold.props(unit)}
        onClick={() => !hold.read() && setReading(unit)}
        className="block w-full touch-none rounded-md select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        <PixelCard unit={unit} blank={blank} />
      </button>
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </>
  )
}
