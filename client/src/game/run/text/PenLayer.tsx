import { useEffect, useRef } from 'react'
import type { Stroke } from '../plan.ts'

const INK = 'rgb(125 255 154 / 0.85)'
// Points closer than this many pixels to the last are skipped, which keeps strokes small.
const STEP = 3

/** The player's own pen strokes over the map; it takes the pointer only while the pen is on. */
export function PenLayer({
  active,
  strokes,
  width,
  height,
  onStroke,
}: {
  active: boolean
  strokes: Stroke[]
  width: number
  height: number
  onStroke: (stroke: Stroke) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)

  const paint = () => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const scale = window.devicePixelRatio || 1
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, width, height)
    context.strokeStyle = INK
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of drawing.current ? [...strokes, drawing.current] : strokes) {
      context.beginPath()
      for (let index = 0; index < stroke.length; index += 2)
        context[index ? 'lineTo' : 'moveTo']((stroke[index] as number) * width, (stroke[index + 1] as number) * height)
      context.stroke()
    }
  }
  useEffect(paint)

  const at = (event: React.PointerEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height] as const
  }

  const scale = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return (
    <canvas
      ref={canvas}
      aria-hidden
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      style={{ width, height }}
      className={`absolute inset-0 z-10 ${active ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
      onPointerDown={(event) => {
        if (!active || event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drawing.current = [...at(event)]
        paint()
      }}
      onPointerMove={(event) => {
        const stroke = drawing.current
        if (!stroke) return
        const [x, y] = at(event)
        const dx = (x - (stroke.at(-2) as number)) * width
        const dy = (y - (stroke.at(-1) as number)) * height
        if (dx * dx + dy * dy < STEP * STEP) return
        stroke.push(x, y)
        paint()
      }}
      onPointerUp={() => {
        const stroke = drawing.current
        drawing.current = null
        if (stroke && stroke.length >= 4) onStroke(stroke)
        else paint()
      }}
      onPointerCancel={() => {
        drawing.current = null
        paint()
      }}
    />
  )
}
