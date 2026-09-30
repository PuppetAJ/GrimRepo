import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useLayoutEffect, useMemo } from 'react'
import { TIP } from 'shared'
import * as THREE from 'three'
import type { View } from '../../view.ts'
import { CENTER_X, TABLE_Y } from '../layout.ts'
import {} from './constants.ts'

/** Unused while the battery shows the lead. */
export function Scale({ view }: { view: View }) {
  const { scene } = useGLTF('/models/scales.glb', false, false)
  const beam = useMemo(() => scene.getObjectByName('Beam'), [scene])
  useLayoutEffect(() => {
    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!material) return
      // Pure metal with nothing to reflect renders black.
      material.metalness = Math.min(material.metalness, 0.6)
      material.emissive.set('#14202a')
    })
  }, [scene])
  useFrame((_, delta) => {
    if (!beam) return
    // The player's pan is on the left, P03's on the right.
    const lean = THREE.MathUtils.clamp(view.scale / TIP, -1, 1)
    easing.damp(beam.rotation, 'y', lean * 0.45, 0.3, delta)
  })
  return (
    <group position={[CENTER_X - 4.7, TABLE_Y, -11.3]} rotation={[0, 0.2, 0]} scale={0.046}>
      <primitive object={scene} />
      <pointLight color="#9fdcff" position={[0, 40, 30]} intensity={0.02} distance={4} decay={2} />
    </group>
  )
}
