import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TABLE_Y } from '../layout.ts'
import { MOOD } from '../mood.ts'
import { TINT } from '../palette.ts'
import { GLOW, lamp, X } from './constants.ts'

/** The three Mox gems, in the gem module from the battery's drone: its gems stand behind a glass front, turned to the player's seat. */
export function GemModule() {
  const { scene } = useGLTF('/models/gems.glb', false, false)
  useLayoutEffect(
    () =>
      scene.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (!material) return
        if (object.name.startsWith('Gem-')) {
          material.emissive.set('#ffffff')
          material.emissiveMap = material.map
          material.emissiveIntensity = 1.4
        } else if (object.name === 'Glass') {
          material.transparent = true
          material.opacity = 0.25
        }
      }),
    [scene],
  )
  // Turned to the seat, then tipped back a little, since the eye is just above it.
  return <primitive object={scene} position={[2.25, TABLE_Y, -12.4]} rotation={[-0.17, -0.48, 0, 'YXZ']} scale={0.9} />
}

/** The lamp on the player's left: a post, an arm, and a bar of light that flickers now and then. */
export function Lamp() {
  const light = useRef<THREE.PointLight>(null)
  // The weathered fluorescent light by Mark Peters (CC BY); its emissive map marks the tubes, which glow in the palette's light.
  const { scene: fixture } = useGLTF('/models/light.glb', false, false)
  const tube = useMemo(() => {
    const mesh = fixture.getObjectByProperty('type', 'Mesh') as THREE.Mesh
    return mesh.material as THREE.MeshStandardMaterial
  }, [fixture])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Steady, with a brief dip every few seconds.
    const flicker = 1 - 0.35 * Math.max(0, Math.sin(t * 9.7) * Math.sin(t * 0.37) - 0.85) * 6
    if (light.current) light.current.intensity = MOOD.lamp * flicker
    tube.emissive.set(lamp(TINT.lamp, MOOD.lampTint)).multiplyScalar(GLOW.g * 0.6 * flicker)
  })
  return (
    <group position={[X - 6.4, TABLE_Y, -10.6]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 3.2, 12]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.12, 20]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[0.9, 3.15, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 1.9, 10]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <primitive object={fixture} position={[1.85, 3.12, -0.2]} rotation={[0.35, 0, 0]} scale={1.05} />
      <pointLight
        ref={light}
        color={lamp(TINT.lamp, MOOD.lampTint)}
        position={[1.85, 2.6, 0.4]}
        intensity={18}
        distance={12}
        decay={1.8}
      />
    </group>
  )
}

/** A rack of drums hanging on the right that turns over slowly, so the room is never still. */
export function DrumRack() {
  const drums = useRef<THREE.Group>(null)
  useFrame((_, delta) => drums.current?.children.forEach((drum) => (drum.rotation.x += delta * 0.4)))
  return (
    <group position={[X + 6.2, 12.4, -16.5]} rotation={[0, -0.25, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[5.2, 0.16, 0.9]} />
        <meshStandardMaterial color="#1c2126" metalness={0.8} roughness={0.5} />
      </mesh>
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 2.4, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
          <meshStandardMaterial color="#1c2126" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
      <group ref={drums}>
        {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.8, 14]} />
            <meshStandardMaterial color="#2b3238" metalness={0.75} roughness={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** A rack on the right of the status screen with P03's hammer and pliers hung on it (not usable yet), and springs on the floor. */
export function Props() {
  const steel = { color: '#20262c', metalness: 0.85, roughness: 0.45 }
  const hammer = useGLTF('/models/hammer.glb', false, false).scene
  const pliers = useGLTF('/models/pliers.glb', false, false).scene
  return (
    <>
      <group position={[X + 7.7, 8.5, -14.4]} rotation={[0, -0.3, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 2.6, 0.12]} />
          <meshStandardMaterial color="#171c21" metalness={0.8} roughness={0.5} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.95, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.36, 8]} />
            <meshStandardMaterial {...steel} />
          </mesh>
        ))}
        {/* Hung by its head, handle down. */}
        <primitive object={hammer} position={[-0.5, 0.2, 0.26]} rotation={[0, 0, Math.PI / 2]} scale={0.7} />
        <primitive object={pliers} position={[0.5, 0.2, 0.26]} rotation={[0, Math.PI / 2, 0]} scale={0.7} />
        <pointLight color={TINT.light} position={[0, 0.4, 1.2]} intensity={MOOD.rackLight} distance={4} decay={2} />
      </group>
      {[
        [X - 6.8, 0.5, -7.5],
        [X + 7.4, 0.5, -8.8],
        [X - 7.6, 1.2, -13],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation={[Math.PI / 2, 0, i]}>
          <torusGeometry args={[0.7, 0.14, 8, 24]} />
          <meshStandardMaterial color="#2a3137" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
    </>
  )
}
