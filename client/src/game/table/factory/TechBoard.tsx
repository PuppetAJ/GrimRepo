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
const UNROLL = 0.45

/** The board, which can roll out from P03's side toward the player `appear` seconds after it mounts, and back as it `leave`s. */
export function TechBoard({
  appear,
  leave = false,
  onClick,
}: {
  appear?: number
  leave?: boolean
  /** A tap on the board's mat, as when bringing it into view from the seat. */
  onClick?: () => void
}) {
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
  const gone = useRef(-1)
  useFrame(({ clock }) => {
    const mesh = board.current
    if (!mesh || (appear === undefined && !leave)) return
    const now = clock.elapsedTime
    if (born.current < 0) born.current = now
    if (leave && gone.current < 0) gone.current = now
    const t = STILL || appear === undefined ? 1 : Math.min(1, Math.max(0, (now - born.current - appear) / UNROLL))
    const back = gone.current < 0 ? 0 : STILL ? 1 : Math.min(1, (now - gone.current) / UNROLL)
    const shown = (1 - (1 - t) ** 3) * (1 - back ** 3)
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
  const rolling = (appear !== undefined || leave) && !STILL
  return (
    <>
      <mesh
        ref={board}
        onClick={
          onClick
            ? (event) => {
                event.stopPropagation()
                onClick()
              }
            : undefined
        }
        visible={appear === undefined || STILL}
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
