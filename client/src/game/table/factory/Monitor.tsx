import { Html } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../layout.ts'
import { TINT } from '../palette.ts'
import { holding, startHold, type Screen } from '../reading.ts'
import { LIT, SCREEN_HDR } from './constants.ts'

// A monitor's text is page text laid on its screen, so it stays sharp when the table renders at a lower resolution.
const SCREEN = { width: 2.66, height: 1.66, px: 512 }
// drei's Html draws 40 CSS pixels to a unit; this fits 512 of them across the screen.
const SCREEN_SCALE = SCREEN.width / (SCREEN.px / 40)
const SCREEN_TEXT: CSSProperties = {
  width: SCREEN.px,
  height: (SCREEN.px * SCREEN.height) / SCREEN.width,
  padding: '16px 22px',
  font: '30px/33px VT323, monospace',
  color: LIT,
  // Stands in for the bloom the scene gives what is brighter than white.
  textShadow: `0 0 6px ${LIT}, 0 0 14px ${LIT}`,
  whiteSpace: 'pre',
  overflow: 'hidden',
}

/** A screen on a bracket: its glass and scanlines in the scene, its text laid over them by the page. */
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
  const cancelHold = useRef<(() => void) | null>(null)
  const letGo = () => {
    cancelHold.current?.()
    cancelHold.current = null
  }
  useEffect(() => letGo, [])
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
      // Named so a sliding finger can tell which screen it is over.
      name={`screen-${screen}`}
      position={position}
      rotation={[0, turn, 0]}
      onPointerDown={(event) => {
        if (!onHold || (event.pointerType !== 'touch' && event.button !== 0)) return
        letGo()
        cancelHold.current = startHold(event, (x, y) => onHold(screen, x, y))
      }}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onClick={(event) => {
        event.stopPropagation()
        // A hold was a look; a click or a tap pins the readout.
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
      {/* Under the page's own overlays, and out of the way of the pointer and screen readers. */}
      <Html transform position={[0, 0, 0.12]} scale={SCREEN_SCALE} zIndexRange={[1, 0]} pointerEvents="none">
        <div aria-hidden style={SCREEN_TEXT}>
          {lines.map((line, i) => (
            <div key={i} style={{ overflow: 'hidden' }}>
              {line}
            </div>
          ))}
        </div>
      </Html>
    </group>
  )
})
