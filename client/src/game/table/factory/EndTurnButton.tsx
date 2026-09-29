import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BELL } from '../layout.ts'
import { Nudge } from '../Piles.tsx'
import { LIT } from './constants.ts'

/** The factory's bell: a big red button that says what it does. */
// The cap's top stands 0.11 above the collar's rim at 0.22; the cap is 0.53 tall at its scale.
const CAP_Y = 0.33 - 0.53

export function EndTurnButton({
  onClick,
  active,
  rung,
}: {
  onClick: (event: ThreeEvent<MouseEvent>) => void
  active: boolean
  rung: number
}) {
  const cap = useRef<THREE.Group>(null)
  const pressed = useRef(0)
  // The PUSH cap from lorib2306's sci-fi button (CC BY), seated in the collar so its skirt is hidden.
  const { scene: model } = useGLTF('/models/button.glb', false, false)
  const glow = useMemo(() => {
    const material = (model.getObjectByName('Cap') as THREE.Mesh).material as THREE.MeshStandardMaterial
    material.emissive.set('#ff3344')
    return material
  }, [model])
  useEffect(() => {
    if (rung) pressed.current = 1
  }, [rung])
  const label = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.fillStyle = '#0b0e11'
    context.fillRect(0, 0, 256, 64)
    context.strokeStyle = '#3a4650'
    context.lineWidth = 4
    context.strokeRect(6, 6, 244, 52)
    context.fillStyle = LIT
    context.font = '40px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('EXECUTE', 128, 33)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => label.dispose(), [label])
  useFrame((_, delta) => {
    pressed.current = Math.max(0, pressed.current - delta * 5)
    if (!cap.current) return
    // Sunk into the collar, standing just proud of it, and pressed a little further in.
    easing.damp(cap.current.position, 'y', CAP_Y - Math.sin(pressed.current * Math.PI) * 0.06, 0.03, delta)
    glow.emissiveIntensity = active ? 0.55 + Math.sin(performance.now() / 300) * 0.2 : 0.06
  })
  const steel = { color: '#2a2f35', metalness: 0.85, roughness: 0.4 }
  return (
    <group position={BELL}>
      <Nudge active={active} onClick={onClick} size={[1.4, 0.7, 1.4]} label="bell" still cursor="press">
        {/* A bolted mounting plate, a collar the cap sits in, and the cap. */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[1.4, 0.06, 1.4]} />
          <meshStandardMaterial color="#1d2227" metalness={0.8} roughness={0.5} />
        </mesh>
        {[-0.58, 0.58].flatMap((x) =>
          [-0.58, 0.58].map((z) => (
            <mesh key={`${x},${z}`} position={[x, 0.075, z]}>
              <cylinderGeometry args={[0.05, 0.05, 0.03, 6]} />
              <meshStandardMaterial {...steel} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.5, 0.56, 0.16, 32]} />
          <meshStandardMaterial {...steel} />
        </mesh>
        <group ref={cap} position={[0, CAP_Y, 0]}>
          <primitive object={model} scale={1.9} />
        </group>
        {/* The label on the plate's near edge. */}
        <mesh position={[0, 0.062, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={label} />
        </mesh>
      </Nudge>
    </group>
  )
}
