import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from './layout.ts'

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
  const material = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = 256
    element.height = 96
    const context = element.getContext('2d') as CanvasRenderingContext2D
    context.font = '72px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 8
    context.strokeStyle = '#0a0e0a'
    context.strokeText(text, 128, 50)
    context.fillStyle = tone === 'heal' ? '#7dff9a' : tone === 'note' ? '#f2c14e' : '#ff5a4f'
    context.fillText(text, 128, 50)
    context.globalCompositeOperation = 'destination-out'
    context.fillStyle = 'rgb(0 0 0 / 0.4)'
    for (let line = 1; line < 96; line += 3) context.fillRect(0, line, 256, 1)
    const map = new THREE.CanvasTexture(element)
    map.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false })
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
    sprite.current.position.set(at[0], at[1] + t * 0.6, at[2])
    material.opacity = 1 - t * t
  })
  return <sprite ref={sprite} material={material} scale={[1.5, 0.56, 1]} renderOrder={10} />
}
