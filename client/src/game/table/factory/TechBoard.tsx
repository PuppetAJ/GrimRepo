import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CARD, LANE_GAP, lanes, ROW_Z, slot, TABLE_Y } from '../layout.ts'
import { LIT } from './constants.ts'

// Drawn for the lanes in layout.ts: slots outlined in the palette's light, with gears, and arrows on P03's queue.
export const BOARD = '/textures/board.webp'

/** The board, projected onto the table. */
export function TechBoard() {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.5
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.5
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.25
  const far = ROW_Z.back - CARD.height / 2 - 0.25
  const texture = useTexture(BOARD)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return (
    <mesh position={[left + width / 2, TABLE_Y + 0.004, far + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} transparent emissive={LIT} emissiveMap={texture} emissiveIntensity={0.5} />
    </mesh>
  )
}
