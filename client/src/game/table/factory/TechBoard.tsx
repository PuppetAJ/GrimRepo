import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CARD, LANE_GAP, lanes, ROW_Z, slot, TABLE_Y, type Row } from '../layout.ts'
import { TINT } from '../palette.ts'
import { LIT } from './constants.ts'

/** The board, drawn onto the table as in Act 3: an off-shade field, slots outlined in the palette's light with three gears each, and arrows on P03's queue. */
export function TechBoard() {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.5
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.5
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.25
  const far = ROW_Z.back - CARD.height / 2 - 0.25
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const scale = 300
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(depth * scale)
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    const px = (x: number) => (x - left) * scale
    const pz = (z: number) => (z - far) * scale
    const w = (CARD.width + 0.08) * scale
    const h = (CARD.height + 0.08) * scale
    // The field: a shade lighter than the table, with a faint edge.
    context.fillStyle = `rgb(${TINT.field} / 0.13)`
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = `rgb(${TINT.line} / 0.25)`
    context.lineWidth = 4
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    const gear = (cx: number, cy: number, r: number, teeth: number) => {
      context.fillStyle = `rgb(${TINT.gear} / 0.9)`
      context.beginPath()
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth + 0.2
        const radius = i % 2 ? r : r * 0.76
        context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      }
      context.closePath()
      context.fill()
      context.fillStyle = TINT.deep
      context.beginPath()
      context.arc(cx, cy, r * 0.42, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = `rgb(${TINT.gear} / 0.9)`
      context.beginPath()
      context.arc(cx, cy, r * 0.28, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = TINT.deep
      context.beginPath()
      context.arc(cx, cy, r * 0.12, 0, Math.PI * 2)
      context.fill()
    }
    const arrow = (cx: number, cy: number, size: number) => {
      context.fillStyle = `rgb(${TINT.line} / 0.3)`
      context.beginPath()
      context.moveTo(cx - size * 0.28, cy - size)
      context.lineTo(cx + size * 0.28, cy - size)
      context.lineTo(cx + size * 0.28, cy)
      context.lineTo(cx + size * 0.7, cy)
      context.lineTo(cx, cy + size)
      context.lineTo(cx - size * 0.7, cy)
      context.lineTo(cx - size * 0.28, cy)
      context.closePath()
      context.fill()
    }
    for (const row of ['back', 'front', 'board'] as Row[]) {
      for (const lane of lanes) {
        const [x, , z] = slot(row, lane)
        const cx = px(x)
        const cy = pz(z)
        const queue = row === 'back'
        context.fillStyle = queue ? `rgb(${TINT.slot} / 0.5)` : `rgb(${TINT.slot} / 0.75)`
        context.strokeStyle = queue ? `rgb(${TINT.line} / 0.35)` : `rgb(${TINT.line} / 0.85)`
        context.lineWidth = 6
        context.beginPath()
        context.roundRect(cx - w / 2, cy - h / 2, w, h, 8)
        context.fill()
        context.stroke()
        if (queue) arrow(cx, cy, h * 0.16)
        else {
          gear(cx + w * 0.05, cy - h * 0.2, h * 0.19, 8)
          gear(cx - w * 0.22, cy + h * 0.2, h * 0.14, 8)
          gear(cx + w * 0.2, cy + h * 0.24, h * 0.12, 8)
        }
      }
    }
    // The line between P03's side and the player's.
    const divide = pz((ROW_Z.board + ROW_Z.front) / 2)
    context.fillStyle = `rgb(${TINT.line} / 0.5)`
    context.fillRect(0.12 * scale, divide - 3, canvas.width - 0.24 * scale, 6)
    // Scanlines over the whole projection.
    context.fillStyle = 'rgb(0 0 0 / 0.28)'
    for (let y = 0; y < canvas.height; y += 6) context.fillRect(0, y, canvas.width, 2)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [width, depth, left, far])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[left + width / 2, TABLE_Y + 0.004, far + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} transparent emissive={LIT} emissiveMap={texture} emissiveIntensity={0.5} />
    </mesh>
  )
}
