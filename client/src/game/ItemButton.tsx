import { m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ITEMS, type ItemId } from 'shared'
import { Sigil } from './CardReader.tsx'
import { fadeIn } from './moves.ts'

const HOLD_MS = 350

export function ItemButton({
  item,
  slot,
  usable,
  pickedUp,
  sizePx,
  onUse,
  className = '',
}: {
  item: ItemId
  slot: number
  usable: boolean
  pickedUp: boolean
  sizePx: number
  onUse: () => void
  className?: string
}) {
  const def = ITEMS[item]
  const [reading, setReading] = useState<{ left: number; bottom: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const heldToRead = useRef(false)
  const pinnedByRightClick = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stop = () => {
    clearTimeout(timer.current)
    pinnedByRightClick.current = false
    setReading(null)
  }
  const show = () => {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - 112), window.innerWidth - 232)
    setReading({ left, bottom: window.innerHeight - rect.top + 8 })
  }
  return (
    <span className="relative inline-block">
      <button
        ref={button}
        type="button"
        data-action="use"
        data-slot={slot}
        aria-disabled={!usable}
        aria-pressed={def.target === 'none' ? undefined : pickedUp}
        aria-label={`${def.name}: ${def.text}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          heldToRead.current = false
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            heldToRead.current = true
            show()
          }, HOLD_MS)
        }}
        onPointerUp={() => !pinnedByRightClick.current && stop()}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(event) => {
          event.preventDefault()
          clearTimeout(timer.current)
          pinnedByRightClick.current = true
          show()
        }}
        onClick={() => {
          if (heldToRead.current) return void (heldToRead.current = false)
          if (usable) onUse()
        }}
        style={{ width: sizePx, height: sizePx }}
        className={`grid touch-none place-items-center rounded-md border-2 bg-[#07130b] text-p03 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 aria-disabled:opacity-40 aria-[disabled=false]:hover:bg-[#13261a] ${pickedUp ? 'border-p03 outline-2 outline-p03 outline-dashed' : 'border-p03-edge'} ${className}`}
      >
        <Sigil id={item} size={Math.round(sizePx * 0.58)} color="currentColor" />
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
