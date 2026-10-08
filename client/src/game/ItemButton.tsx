import { m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ITEMS, type ItemId } from 'shared'
import { Sigil } from './CardReader.tsx'
import { fadeIn } from './moves.ts'

/** How long a press must last to read the item instead of using it, in milliseconds. */
const HOLD_MS = 350

/**
 * An item's button, on either table: a click uses it or picks it up; holding it shows it larger with what it does, and
 * letting go after a hold isn't a click.
 */
export function ItemButton({
  item,
  slot,
  usable,
  held,
  size,
  onUse,
  className = '',
}: {
  item: ItemId
  slot: number
  usable: boolean
  /** Picked up, to aim at a card. */
  held: boolean
  /** The button's side, in pixels. */
  size: number
  onUse: () => void
  className?: string
}) {
  const def = ITEMS[item]
  // Where the reading shows: above the button, kept on the screen, in a portal so no panel's edge clips it.
  const [reading, setReading] = useState<{ left: number; bottom: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const read = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stop = () => {
    clearTimeout(timer.current)
    setReading(null)
  }
  return (
    <span className="relative inline-block">
      <button
        ref={button}
        type="button"
        data-action="use"
        data-slot={slot}
        // Readable even when it can't be used, so it stays enabled and says so instead.
        aria-disabled={!usable}
        aria-pressed={def.target === 'none' ? undefined : held}
        aria-label={`${def.name}: ${def.text}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          read.current = false
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            read.current = true
            const rect = button.current?.getBoundingClientRect()
            if (!rect) return
            const left = Math.min(Math.max(8, rect.left + rect.width / 2 - 112), window.innerWidth - 232)
            setReading({ left, bottom: window.innerHeight - rect.top + 8 })
          }, HOLD_MS)
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          if (read.current) return void (read.current = false)
          if (usable) onUse()
        }}
        style={{ width: size, height: size }}
        className={`grid touch-none place-items-center rounded-md border-2 bg-[#07130b] text-p03 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 aria-disabled:opacity-40 aria-[disabled=false]:hover:bg-[#13261a] ${held ? 'border-p03 outline-2 outline-p03 outline-dashed' : 'border-p03-edge'} ${className}`}
      >
        <Sigil id={item} size={Math.round(size * 0.58)} color="currentColor" />
      </button>
      {reading
        ? createPortal(
            <m.span
              aria-hidden
              {...fadeIn(0.12)}
              style={{ left: reading.left, bottom: reading.bottom }}
              className="pointer-events-none fixed z-[70] flex w-56 flex-col items-center gap-2 rounded-md border-2 border-p03 bg-p03-ground p-3 text-center text-p03 shadow-[0_0_18px_rgb(125_255_154/0.45)]"
            >
              <Sigil id={item} size={56} color="currentColor" />
              <span className="font-terminal text-xl">{def.name}</span>
              <span className="font-sans text-sm text-[#b8f5c4]">{def.text}</span>
            </m.span>,
            document.body,
          )
        : null}
    </span>
  )
}
