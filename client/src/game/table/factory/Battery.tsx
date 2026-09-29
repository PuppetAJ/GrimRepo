import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { View } from '../../view.ts'
import { BATTERY_CELLS, leadCells, TABLE_Y } from '../layout.ts'
import { TINT } from '../palette.ts'
import { X } from './constants.ts'
import { mergeStill } from './mergeStill.ts'

const RED = '#ff4a3d'

/** Act 3's battery, hovering by the table: the scale fills its cells from the leader's end, the player's colour from their end and red from P03's. */
export function Battery({ view }: { view: View }) {
  const { scene } = useGLTF('/models/battery.glb', false, false)
  const drone = useRef<THREE.Group>(null)
  const { cells, propellers } = useMemo(() => {
    // The frame never moves, so its pieces are drawn as one; the cells light and the propellers turn, so they stay apart.
    mergeStill(scene, /^(Cell-\d|Left-Propeller|Right-Propeller)$/)
    return {
      cells: [...Array(BATTERY_CELLS).keys()].map((i) => {
        const cell = scene.getObjectByName(`Cell-${i}`) as THREE.Mesh
        // Each cell gets its own material, once, so it can light alone.
        cell.userData['own'] ??= (cell.material as THREE.MeshStandardMaterial).clone()
        cell.material = cell.userData['own'] as THREE.MeshStandardMaterial
        return { material: cell.material as THREE.MeshStandardMaterial, glow: 0, since: 0, on: false }
      }),
      propellers: ['Left-Propeller', 'Right-Propeller'].map((name) => scene.getObjectByName(name) as THREE.Object3D),
    }
  }, [scene])
  const lit = leadCells(view.scale)
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    cells.forEach((cell, i) => {
      // Counted from the leader's end: full cells burn, and the next glows as far as the scale has reached into it.
      const fill = THREE.MathUtils.clamp(Math.abs(lit) - (lit > 0 ? i : BATTERY_CELLS - 1 - i), 0, 1)
      const on = fill > 0
      if (on !== cell.on) {
        cell.on = on
        cell.since = t
      }
      if (on) cell.material.emissive.set(lit > 0 ? TINT.you : RED)
      // A cell stutters as it comes on, like a tube catching.
      const catching = on && t - cell.since < 0.3 ? (Math.sin((t - cell.since) * 90) > 0 ? 1 : 0.15) : 1
      cell.glow = THREE.MathUtils.damp(cell.glow, fill, 10, delta)
      cell.material.emissiveIntensity = cell.glow * catching * 1.6
      cell.material.color.setScalar(0.3 + cell.glow * 0.4)
    })
    // The propellers spin up with the lead, whoever holds it.
    for (const propeller of propellers) propeller.rotateZ(delta * (8 + Math.abs(lit) * 2))
    if (drone.current) {
      drone.current.position.y = Math.sin(t * 1.4) * 0.05
      drone.current.rotation.z = Math.sin(t * 0.9) * 0.025
    }
  })
  return (
    <group position={[X - 4.8, TABLE_Y + 0.9, -11.3]} rotation={[0, 0.55, 0]}>
      <group ref={drone} scale={0.7}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
