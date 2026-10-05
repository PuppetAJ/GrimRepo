import { Html } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../layout.ts'
import { TINT } from '../palette.ts'
import { holding, startHold, type Screen } from '../reading.ts'
import { LIT, SCREEN_HDR, STILL } from './constants.ts'

// The text is page HTML over the screen, so it stays sharp when the table renders at a lower resolution.
const SCREEN = { width: 2.66, height: 1.66, px: 512 }
// drei's Html draws 40 CSS pixels per unit; this fits 512 across the screen.
const SCREEN_SCALE = SCREEN.width / (SCREEN.px / 40)
const SCREEN_TEXT: CSSProperties = {
  width: SCREEN.px,
  height: (SCREEN.px * SCREEN.height) / SCREEN.width,
  padding: '16px 22px',
  font: '30px/33px VT323, monospace',
  color: LIT,
  // Stands in for the bloom that HTML text doesn't get.
  textShadow: `0 0 6px ${LIT}, 0 0 14px ${LIT}`,
  whiteSpace: 'pre',
  overflow: 'hidden',
}

/** Characters a second the monitors type at, sped up so a big change never takes longer than MOST_TYPING seconds. */
const TYPE_RATE = 140
const MOST_TYPING = 0.9

/** Which new lines were already on screen: in place, or moved up as a log scrolls. */
function kept(before: string[], after: string[]): boolean[] {
  let best = after.map(() => false)
  let most = -1
  for (let shift = 0; shift <= before.length; shift++) {
    const keep = after.map((line, index) => before[index + shift] === line || before[index] === line)
    const count = keep.filter(Boolean).length
    if (count > most) {
      best = keep
      most = count
    }
  }
  return best
}

/** The lines as typed so far: new and changed lines type in, in order, behind a cursor; the rest stay put. */
function useTyped(lines: string[]): string[] {
  const [shown, setShown] = useState(lines)
  const last = useRef(lines)
  useEffect(() => {
    const before = last.current
    last.current = lines
    if (before === lines) return
    const keep = kept(before, lines)
    const total = lines.reduce((sum, line, index) => sum + (keep[index] ? 0 : line.length), 0)
    const rate = Math.max(TYPE_RATE, total / MOST_TYPING)
    const start = performance.now()
    let frame = 0
    const step = () => {
      let budget = STILL ? Infinity : ((performance.now() - start) / 1000) * rate
      const typed = lines.map((line, index) => {
        if (keep[index]) return line
        const count = Math.floor(Math.min(line.length, Math.max(0, budget)))
        const typing = budget > 0 && count < line.length
        budget -= line.length
        // A space keeps an untyped line's height, so the lines below don't jump.
        return `${line.slice(0, count)}${typing ? '_' : ''}` || ' '
      })
      setShown(typed)
      if (budget < 0) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [lines])
  return shown
}

export const Monitor = memo(function Monitor({
  screen,
  position,
  turn,
  lines,
  onHold,
  onPin,
}: {
  screen: Screen
  position: Vec3
  turn: number
  lines: string[]
  onHold?: (screen: Screen, x: number, y: number) => void
  onPin?: (screen: Screen) => void
}) {
  const typed = useTyped(lines)
  const cancelHold = useRef<(() => void) | null>(null)
  const endHold = () => {
    cancelHold.current?.()
    cancelHold.current = null
  }
  useEffect(() => endHold, [])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 320
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.fillStyle = TINT.screenGround
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = `rgb(${TINT.line} / 0.06)`
    for (let y = 0; y < canvas.height; y += 4) context.fillRect(0, y, canvas.width, 1)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group
      // HeldReader finds screens by this name.
      name={`screen-${screen}`}
      position={position}
      rotation={[0, turn, 0]}
      onPointerDown={(event) => {
        if (!onHold || (event.pointerType !== 'touch' && event.button !== 0)) return
        endHold()
        cancelHold.current = startHold(event, (x, y) => onHold(screen, x, y))
      }}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onClick={(event) => {
        event.stopPropagation()
        // A hold was for reading; a click or tap pins the readout.
        if (!holding()) onPin?.(screen)
      }}
    >
      <mesh>
        <boxGeometry args={[2.9, 1.95, 0.22]} />
        <meshStandardMaterial color="#171c21" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <meshBasicMaterial map={texture} color={SCREEN_HDR} />
      </mesh>
      {/* Below the page's overlays, and out of the way of the pointer and screen readers. */}
      <Html transform position={[0, 0, 0.12]} scale={SCREEN_SCALE} zIndexRange={[1, 0]} pointerEvents="none">
        <div aria-hidden style={SCREEN_TEXT}>
          {typed.map((line, i) => (
            <div key={i} style={{ overflow: 'hidden' }}>
              {line}
            </div>
          ))}
        </div>
      </Html>
    </group>
  )
})
