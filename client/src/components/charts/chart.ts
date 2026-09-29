import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { PlayerStats } from '../../lib/api.ts'

export type Game = PlayerStats['recent'][number]

// The least a chart is drawn at; given more room by its card, it takes it.
const MIN_HEIGHT = 160
export const PAD = { top: 12, right: 8, bottom: 8, left: 44 }
export const colorOf = (game: Game) =>
  game.forfeited ? 'var(--muted-foreground)' : game.outcome === 'win' ? 'var(--primary)' : 'var(--death)'
export const resultOf = (game: Game) => (game.forfeited ? 'forfeited' : game.outcome === 'win' ? 'won' : 'lost')
export const ending = (game: Game) =>
  game.forfeited
    ? `Forfeited on turn ${game.turns}`
    : game.outcome === 'win'
      ? `Won in ${game.turns} turns`
      : `Lost on turn ${game.turns}`

/**
 * The room a chart has to draw in, so it is drawn in real pixels and its dots stay round. The drawing sits over its box
 * rather than in it, so it never holds the box open: the box follows the card, and the drawing follows the box.
 */
export function useSize() {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: MIN_HEIGHT })
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: Math.max(MIN_HEIGHT, element.clientHeight) }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [box, size.width, size.height] as const
}

/** Which game the pointer is over, by where it is across the chart; a tap counts as much as a hover. */
export function useHover(indexAt: (x: number) => number) {
  const [hover, setHover] = useState<number | null>(null)
  const track = (event: PointerEvent<SVGSVGElement>) =>
    setHover(indexAt(event.clientX - event.currentTarget.getBoundingClientRect().left))
  return { hover, handlers: { onPointerMove: track, onPointerDown: track, onPointerLeave: () => setHover(null) } }
}
