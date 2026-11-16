import { ZoomIn } from 'lucide-react'
import { m } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'
import { warmPop, type Move } from '../../moves.ts'
import { Rising } from '../../text/Board.tsx'
import { CardReader, SigilIcons, useCardSearch } from './CardBits.tsx'

type Props = {
  units: Unit[]
  onPick?: (unit: Unit) => void
  data?: (unit: Unit) => Record<string, string | number>
  can?: (unit: Unit) => boolean
  picked?: number | null
  chosen?: number[]
  itemMove?: (index: number) => Move
  spellSigils?: boolean
  itemClassName?: string
  searchable?: boolean
  flash?: { uid: number; key: number; text: string }
  badge?: (unit: Unit) => ReactNode
}

function Caption({
  unit,
  spellSigils,
  onRead,
  badge,
}: {
  unit: Unit
  spellSigils: boolean
  onRead: () => void
  badge?: ReactNode
}) {
  const name = card(unit.card).name
  return (
    <span className="flex min-w-0 flex-col gap-1 text-left leading-tight">
      <span className="flex min-w-0 items-center gap-1">
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
      {spellSigils ? (
        unit.sigils.map((sigil) => (
          <span key={sigil} className="font-sans text-sm text-foreground">
            <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
          </span>
        ))
      ) : (
        <span className="flex items-center justify-between gap-2">
          <SigilIcons sigils={unit.sigils} size={14} />
          {badge}
        </span>
      )}
    </span>
  )
}

export function CardList({
  units,
  onPick,
  data,
  can = () => true,
  picked = null,
  chosen: several,
  itemMove,
  spellSigils = false,
  itemClassName = 'w-28',
  searchable = false,
  flash,
  badge,
}: Props) {
  const [reading, setReading] = useState<Unit | null>(null)
  const hold = useHoldToRead(setReading)
  const { matches } = useCardSearch()
  const shown = searchable ? units.filter(matches) : units
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap justify-center gap-4 pt-3">
        {shown.map((unit, index) => {
          const allowed = can(unit)
          const chosen = picked === unit.uid || Boolean(several?.includes(unit.uid))
          const flashed = flash?.uid === unit.uid ? flash : undefined
          const face = flashed ? (
            <m.span key={flashed.key} {...warmPop} className="relative block">
              <PixelCard unit={unit} />
              <Rising text={flashed.text} tone="note" className="top-1/3 left-1/2 text-2xl" />
            </m.span>
          ) : (
            <PixelCard unit={unit} />
          )
          return (
            <m.li key={unit.uid} {...itemMove?.(index)} className={`flex shrink-0 flex-col gap-2 ${itemClassName}`}>
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
                <button
                  type="button"
                  data-read
                  aria-label={`Read ${describe(unit)}`}
                  {...hold.props(unit)}
                  onClick={() => !hold.read() && setReading(unit)}
                  className="touch-manipulation rounded-md p-1 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
                >
                  {face}
                </button>
              )}
              <Caption unit={unit} spellSigils={spellSigils} onRead={() => setReading(unit)} badge={badge?.(unit)} />
            </m.li>
          )
        })}
      </ul>
      {shown.length ? null : <p className="text-center text-lg text-p03-dim">No card matches.</p>}
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </div>
  )
}

const HOLD_MS = 350

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
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault()
        stop()
        open(unit)
      },
    }),
    read: () => {
      const was = held.current
      held.current = false
      return was
    },
  }
}

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
        data-read
        aria-label={label ?? `Read ${card(unit.card).name}`}
        {...hold.props(unit)}
        onClick={() => !hold.read() && setReading(unit)}
        className="block w-full touch-manipulation rounded-md select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        <PixelCard unit={unit} blank={blank} />
      </button>
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </>
  )
}
