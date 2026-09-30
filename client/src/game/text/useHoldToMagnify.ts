import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Slot, Unit } from 'shared'

// Long enough that a tap still reads as a click.
const HOLD_MS = 280
// Longer than a touch's click can trail its touchend, so that click is still swallowed.
const HELD_MS = 400

type Magnified = { unit: Unit; x: number; y: number }

/** Holding a card magnifies it; sliding then reads whichever card `pointAt` finds under the pointer. */
export function useHoldToMagnify(pointAt: (x: number, y: number) => Unit | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const [magnified, setMagnified] = useState<Magnified | null>(null)
  const latest = useRef(pointAt)
  useEffect(() => {
    latest.current = pointAt
  })

  const magnifying = magnified !== null
  // While magnifying, sliding reads the card underneath and the page must not scroll.
  useEffect(() => {
    if (!magnifying) return
    const move = ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      const unit = latest.current(clientX, clientY)
      setMagnified((last) => (last ? { unit: unit ?? last.unit, x: clientX, y: clientY } : last))
    }
    const touchMove = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      if (touch) move(touch)
    }
    const pointerMove = (event: globalThis.PointerEvent) => event.pointerType === 'mouse' && move(event)
    // A hold can end with no click inside the table to clear the flag, which would swallow the next one.
    const end = () => {
      setMagnified(null)
      setTimeout(() => (held.current = false), HELD_MS)
    }
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
  }, [magnifying])

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const endHold = () => {
    cancel()
    setMagnified(null)
  }

  /** A card's pointer handlers; `onHold` runs as the hold begins. */
  const holdProps = (unit: Slot, onHold: () => void) => ({
    onPointerDown: (event: PointerEvent) => {
      if (!unit || (event.pointerType !== 'touch' && event.button !== 0)) return
      held.current = false
      const [x, y] = [event.clientX, event.clientY]
      timer.current = setTimeout(() => {
        held.current = true
        onHold()
        setMagnified({ unit, x, y })
      }, HOLD_MS)
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    // A touch keeps its hold until lifted; a mouse leaving early cancels the pending hold.
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && !magnified) cancel()
    },
  })

  // Swallows the click that ends a hold, so a held card is read and not played.
  const frameProps = {
    onContextMenu: (event: MouseEvent) => (timer.current || held.current) && event.preventDefault(),
    onClickCapture: (event: MouseEvent) => {
      if (!held.current) return
      held.current = false
      event.stopPropagation()
      event.preventDefault()
    },
  }

  return { magnified, holdProps, frameProps }
}
