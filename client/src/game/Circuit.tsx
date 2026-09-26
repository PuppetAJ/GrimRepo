import { useEffect, useRef } from 'react'

// A printed circuit behind the Act 2 table: nodes on a grid joined by right-angled traces, made once for each size,
// with a few faint signals wandering along them. After the circuit background on shadcn.io, drawn here in P03's green.
const STEP = 36
const PULSES = 5
// A signal's life, in seconds, the first and last of it spent fading in and out, so none appears or vanishes at once.
const LIFE = 14
const FADE = 2.5

type Edge = [number, number, number, number]

/** A seeded walk over the grid: each trace leaves a node and bends once, and some end in a pad. */
function traces(width: number, height: number): { edges: Edge[]; pads: [number, number][] } {
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const cols = Math.ceil(width / STEP)
  const rows = Math.ceil(height / STEP)
  const edges: Edge[] = []
  const pads: [number, number][] = []
  for (let i = 0; i < (cols * rows) / 5; i++) {
    let x = Math.floor(random() * cols) * STEP
    let y = Math.floor(random() * rows) * STEP
    pads.push([x, y])
    for (let leg = 0; leg < 2 + Math.floor(random() * 3); leg++) {
      const along = Math.ceil(random() * 4) * STEP * (random() < 0.5 ? -1 : 1)
      const [nx, ny] = leg % 2 === 0 ? [x + along, y] : [x, y + along]
      edges.push([x, y, nx, ny])
      ;[x, y] = [nx, ny]
    }
    if (random() < 0.5) pads.push([x, y])
  }
  return { edges, pads }
}

export function Circuit() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const context = element.getContext('2d') as CanvasRenderingContext2D
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let board = document.createElement('canvas')
    let edges: Edge[] = []
    // Which traces meet at each point, so a signal can turn a corner rather than jump.
    let meeting = new Map<string, number[]>()
    type Pulse = { edge: number; forward: boolean; at: number; speed: number; age: number }
    let pulses: Pulse[] = []
    const key = (x: number, y: number) => `${x},${y}`
    const born = (age = 0): Pulse => ({
      edge: Math.floor(Math.random() * edges.length),
      forward: Math.random() < 0.5,
      at: Math.random(),
      speed: 14 + Math.random() * 10,
      age,
    })
    // At a trace's end the signal takes another trace from that point, or turns back if there is none.
    const onward = (pulse: Pulse) => {
      const [x0, y0, x1, y1] = edges[pulse.edge] as Edge
      const [ex, ey] = pulse.forward ? [x1, y1] : [x0, y0]
      const next = (meeting.get(key(ex, ey)) ?? []).filter((edge) => edge !== pulse.edge)
      if (!next.length) {
        pulse.forward = !pulse.forward
      } else {
        pulse.edge = next[Math.floor(Math.random() * next.length)] as number
        const [nx0, ny0] = edges[pulse.edge] as Edge
        pulse.forward = nx0 === ex && ny0 === ey
      }
      pulse.at = 0
    }
    // The traces are drawn once, on a canvas of their own, and copied under the pulses each frame.
    const lay = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const { clientWidth: w, clientHeight: h } = element
      element.width = board.width = w * ratio
      element.height = board.height = h * ratio
      const made = traces(w, h)
      edges = made.edges
      meeting = new Map()
      edges.forEach(([x0, y0, x1, y1], i) => {
        for (const point of [key(x0, y0), key(x1, y1)]) meeting.set(point, [...(meeting.get(point) ?? []), i])
      })
      const ink = board.getContext('2d') as CanvasRenderingContext2D
      ink.scale(ratio, ratio)
      ink.strokeStyle = 'rgb(125 255 154 / 0.07)'
      ink.lineWidth = 1.5
      ink.lineCap = 'round'
      ink.beginPath()
      for (const [x0, y0, x1, y1] of edges) {
        ink.moveTo(x0, y0)
        ink.lineTo(x1, y1)
      }
      ink.stroke()
      ink.fillStyle = 'rgb(125 255 154 / 0.14)'
      for (const [x, y] of made.pads) ink.fillRect(x - 2.5, y - 2.5, 5, 5)
      // Spread through their lives, so they do not all fade together.
      pulses = [...Array(PULSES)].map((_, i) => born((LIFE * i) / PULSES))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    let frame = 0
    let last = performance.now()
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      context.clearRect(0, 0, element.width, element.height)
      context.drawImage(board, 0, 0, element.clientWidth, element.clientHeight)
      if (!still)
        for (const pulse of pulses) {
          pulse.age += dt
          // A signal whose life is over is born again elsewhere, unseen, and fades in there.
          if (pulse.age >= LIFE) Object.assign(pulse, born())
          const [x0, y0, x1, y1] = edges[pulse.edge] as Edge
          const length = Math.hypot(x1 - x0, y1 - y0) || 1
          pulse.at += (dt * pulse.speed) / length
          if (pulse.at >= 1) onward(pulse)
          const along = pulse.forward ? pulse.at : 1 - pulse.at
          const [ax, ay, bx, by] = edges[pulse.edge] as Edge
          const [x, y] = [ax + (bx - ax) * along, ay + (by - ay) * along]
          const fade = Math.min(1, pulse.age / FADE, (LIFE - pulse.age) / FADE)
          const glow = context.createRadialGradient(x, y, 0, x, y, 7)
          glow.addColorStop(0, `rgb(170 255 190 / ${0.22 * fade})`)
          glow.addColorStop(1, 'rgb(125 255 154 / 0)')
          context.fillStyle = glow
          context.fillRect(x - 7, y - 7, 14, 14)
        }
      frame = requestAnimationFrame(draw)
    }
    lay()
    frame = requestAnimationFrame(draw)
    const observer = new ResizeObserver(() => {
      board = document.createElement('canvas')
      lay()
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])
  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 z-0 size-full" />
}
