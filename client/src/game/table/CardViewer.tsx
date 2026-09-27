import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { use, useMemo, useRef } from 'react'
import { card, type Unit } from 'shared'
import * as THREE from 'three'
import { Disk, type DiskHandle } from './Disk.tsx'
import { backTexture, faceContent, faceLights, faceTexture, loadCardAssets } from './faces.ts'
import { FactoryEffects } from './Factory.tsx'

// The compendium's 3D view: one card on its disk, lit and graded as the factory table lights it.

function Lights() {
  return (
    <>
      <fog attach="fog" args={['#02070c', 4, 30]} />
      <ambientLight color="#1a3a4a" intensity={0.45} />
      <hemisphereLight color="#123040" groundColor="#000000" intensity={0.8} />
      <spotLight
        color="#d8f4ff"
        position={[0, 6, 2]}
        angle={0.6}
        penumbra={0.6}
        intensity={90}
        decay={1.6}
        distance={20}
      />
      <pointLight color="#9fdcff" position={[2, 2, 2]} intensity={10} distance={8} decay={1.8} />
    </>
  )
}

/** One disk, opening and closing as it does when drawn, turning slowly if asked. */
function Card({ unit, open, turn }: { unit: Unit; open: boolean; turn: boolean }) {
  const assets = use(loadCardAssets())
  const group = useRef<THREE.Group>(null)
  const disk = useRef<DiskHandle>(null)
  const openness = useRef(open ? 1 : 0)
  const materials = useMemo(
    () => ({
      front: new THREE.MeshStandardMaterial({ roughness: 0.85, transparent: true, alphaTest: 0.5 }),
      back: new THREE.MeshStandardMaterial({ roughness: 0.85, transparent: true, alphaTest: 0.5 }),
      content: new THREE.MeshStandardMaterial({
        roughness: 0.85,
        emissive: '#ffffff',
        transparent: true,
        alphaTest: 0.5,
      }),
    }),
    [],
  )
  materials.front.map = faceTexture(unit, assets)
  materials.content.map = faceContent(unit, assets)
  materials.content.emissiveMap = faceLights(unit, assets)
  materials.back.map = backTexture()
  useFrame((_, delta) => {
    if (turn && group.current) group.current.rotation.y += delta * 0.6
    if (!turn && group.current) group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, 0, 4, delta)
    // The same easing and fade the game uses when a card is drawn.
    openness.current = THREE.MathUtils.damp(openness.current, open ? 1 : 0, 6, delta)
    disk.current?.setOpen(openness.current)
    materials.content.emissiveIntensity = 1.1 * openness.current * openness.current
    materials.content.opacity = openness.current
    materials.content.alphaTest = Math.max(0.001, materials.content.opacity * 0.5)
  })
  return (
    <group ref={group}>
      <Disk
        ref={disk}
        open={open ? 1 : 0}
        kind={card(unit.card).tier === 'S' ? 'rare' : 'common'}
        front={materials.front}
        content={materials.content}
        back={materials.back}
      />
    </group>
  )
}

export default function CardViewer({ unit, open, turn }: { unit: Unit; open: boolean; turn: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 2.2], fov: 45 }}
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      aria-label={`${card(unit.card).name} on its disk`}
    >
      <color attach="background" args={['#02070c']} />
      <Lights />
      <Card unit={unit} open={open} turn={turn} />
      {/* A floor under the disk, lit up in P03's green so it shows through the factory's dark. */}
      <gridHelper args={[10, 20, '#4fae6a', '#2a6a40']} position={[0, -0.8, 0]} />
      <FactoryEffects />
      <OrbitControls makeDefault enablePan={false} minDistance={1.4} maxDistance={4} />
    </Canvas>
  )
}
