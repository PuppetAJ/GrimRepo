import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CARD, LANE_GAP, lanes, ROW_Z, slot, TABLE_Y } from '../layout.ts'
import { TINT } from '../palette.ts'
import { LIT, STILL } from './constants.ts'

export const BOARD = '/textures/board.webp'

const UNROLL_SECONDS = 0.45

export function TechBoard({
  appearAfter,
  leave = false,
  onClick,
}: {
  appearAfter?: number
  leave?: boolean
  onClick?: () => void
}) {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.5
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.5
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.25
  const far = ROW_Z.back - CARD.height / 2 - 0.25
  const shared = useTexture(BOARD)
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
    if (!mesh || (appearAfter === undefined && !leave)) return
    const now = clock.elapsedTime
    if (born.current < 0) born.current = now
    if (leave && gone.current < 0) gone.current = now
    const t =
      STILL || appearAfter === undefined
        ? 1
        : Math.min(1, Math.max(0, (now - born.current - appearAfter) / UNROLL_SECONDS))
    const back = gone.current < 0 ? 0 : STILL ? 1 : Math.min(1, (now - gone.current) / UNROLL_SECONDS)
    const shown = (1 - (1 - t) ** 3) * (1 - back ** 3)
    mesh.visible = shown > 0
    mesh.scale.y = Math.max(shown, 0.0001)
    mesh.position.z = far + (depth * shown) / 2
    texture.repeat.y = shown
    texture.offset.y = 1 - shown
    if (edge.current) {
      edge.current.visible = shown > 0 && shown < 1
      edge.current.position.z = far + depth * shown
    }
  })
  const rolling = (appearAfter !== undefined || leave) && !STILL
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
        visible={appearAfter === undefined || STILL}
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
