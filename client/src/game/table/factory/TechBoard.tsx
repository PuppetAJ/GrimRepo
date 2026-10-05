import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CARD, LANE_GAP, lanes, ROW_Z, slot, TABLE_Y } from '../layout.ts'
import { TINT } from '../palette.ts'
import { LIT, STILL } from './constants.ts'

// The texture is drawn to match the lanes in layout.ts.
export const BOARD = '/textures/board.webp'

/** Seconds the board takes to roll out across the table. */
const UNROLL = 0.6

/** The board, which can roll out from P03's side toward the player, `appear` seconds after it mounts. */
export function TechBoard({ appear }: { appear?: number }) {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.5
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.5
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.25
  const far = ROW_Z.back - CARD.height / 2 - 0.25
  const shared = useTexture(BOARD)
  // Its own copy, since rolling out crops the texture.
  const texture = useMemo(() => {
    const copy = shared.clone()
    copy.colorSpace = THREE.SRGBColorSpace
    copy.anisotropy = 8
    copy.needsUpdate = true
    return copy
  }, [shared])
  useEffect(() => () => texture.dispose(), [texture])
  const board = useRef<THREE.Mesh>(null)
  const edge = useRef<THREE.Mesh>(null)
  const born = useRef(-1)
  useFrame(({ clock }) => {
    const mesh = board.current
    if (!mesh || appear === undefined) return
    if (born.current < 0) born.current = clock.elapsedTime
    const t = STILL ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - born.current - appear) / UNROLL))
    const shown = 1 - (1 - t) ** 3
    mesh.visible = shown > 0
    // Shows only the far part of the board, uncropped, so it reveals rather than stretches.
    mesh.scale.y = Math.max(shown, 0.0001)
    mesh.position.z = far + (depth * shown) / 2
    texture.repeat.y = shown
    texture.offset.y = 1 - shown
    if (edge.current) {
      edge.current.visible = shown > 0 && shown < 1
      edge.current.position.z = far + depth * shown
    }
  })
  const rolling = appear !== undefined && !STILL
  return (
    <>
      <mesh
        ref={board}
        visible={!rolling}
        position={[left + width / 2, TABLE_Y + 0.004, far + depth / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={texture} transparent emissive={LIT} emissiveMap={texture} emissiveIntensity={0.5} />
      </mesh>
      {rolling ? (
        <mesh
          ref={edge}
          visible={false}
          position={[left + width / 2, TABLE_Y + 0.006, far]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, 0.035]} />
          <meshBasicMaterial color={TINT.glow} toneMapped={false} />
        </mesh>
      ) : null}
    </>
  )
}
