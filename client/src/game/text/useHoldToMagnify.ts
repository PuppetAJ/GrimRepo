import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Slot, Unit } from 'shared'

const HOLD_MS = 280
const TRAILING_CLICK_MS = 400

type Magnified = { unit: Unit; x: number; y: number; sticky?: boolean }

const survivesRelease = (magnified: Magnified | null) => (magnified?.sticky ? magnified : null)

export function useHoldToMagnify(pointAt: (x: number, y: number) => Unit | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const swallowDismissClick = useRef(false)
  const [magnified, setMagnified] = useState<Magnified | null>(null)
  const latest = useRef(pointAt)
  useEffect(() => {
    latest.current = pointAt
  })

  const magnifying = magnified !== null
  const sticky = magnified?.sticky ?? false
  useEffect(() => {
    if (!sticky) return
    const end = () => {
      swallowDismissClick.current = true
      setMagnified(null)
      setTimeout(() => (swallowDismissClick.current = false), TRAILING_CLICK_MS)
    }
    const key = (event: KeyboardEvent) => event.key === 'Escape' && end()
    window.addEventListener('pointerdown', end, true)
    window.addEventListener('keydown', key)
    window.addEventListener('wheel', end, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', end, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('wheel', end)
    }
  }, [sticky])
  useEffect(() => {
    if (!magnifying || sticky) return
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
    const end = () => {
      setMagnified(null)
      setTimeout(() => (held.current = false), TRAILING_CLICK_MS)
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
  }, [magnifying, sticky])

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const endHold = () => {
    cancel()
    setMagnified(survivesRelease)
  }

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
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && !magnified) cancel()
    },
  })

  const swallowClickAfterHold = (event: MouseEvent) => {
    if (!held.current && !swallowDismissClick.current) return
    held.current = false
    swallowDismissClick.current = false
    event.stopPropagation()
    event.preventDefault()
  }

  const frameProps = {
    onContextMenu: (event: MouseEvent) => (timer.current || held.current) && event.preventDefault(),
    onClickCapture: swallowClickAfterHold,
  }

  const magnify = (unit: Unit, x: number, y: number) => setMagnified({ unit, x, y, sticky: true })

  return { magnified, holdProps, frameProps, magnify }
}
