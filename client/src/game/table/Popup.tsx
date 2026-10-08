import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STILL } from './factory/constants.ts'
import type { Vec3 } from './layout.ts'

// The canvas's width for a short popup, such as a number; the sprite widens with it for longer words.
const WIDTH = 256

export function Popup({
  text,
  tone,
  position: at,
  born,
}: {
  text: string
  tone: string
  position: Vec3
  born: number
}) {
  const sprite = useRef<THREE.Sprite>(null)
  // A canvas wide enough for the words, so a long one such as "rolled back" isn't cut off at its ends.
  const { material, wide } = useMemo(() => {
    const element = document.createElement('canvas')
    const font = '72px VT323'
    const measure = element.getContext('2d') as CanvasRenderingContext2D
    measure.font = font
    element.width = Math.max(WIDTH, Math.ceil(measure.measureText(text).width) + 24)
    element.height = 96
    const context = element.getContext('2d') as CanvasRenderingContext2D
    const middle = element.width / 2
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 8
    context.strokeStyle = '#0a0e0a'
    context.strokeText(text, middle, 50)
    context.fillStyle = tone === 'heal' ? '#7dff9a' : tone === 'note' ? '#f2c14e' : '#ff5a4f'
    context.fillText(text, middle, 50)
    context.globalCompositeOperation = 'destination-out'
    context.fillStyle = 'rgb(0 0 0 / 0.4)'
    for (let line = 1; line < 96; line += 3) context.fillRect(0, line, element.width, 1)
    const map = new THREE.CanvasTexture(element)
    map.colorSpace = THREE.SRGBColorSpace
    const made = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false })
    return { material: made, wide: element.width / WIDTH }
  }, [text, tone])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  useFrame(() => {
    if (!sprite.current) return
    const t = Math.min(1, (performance.now() - born) / 1000)
    sprite.current.position.set(at[0], at[1] + (STILL ? 0 : t * 0.6), at[2])
    material.opacity = 1 - t * t
  })
  return <sprite ref={sprite} material={material} scale={[1.5 * wide, 0.56, 1]} renderOrder={10} />
}
