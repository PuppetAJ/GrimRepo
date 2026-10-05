import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { STILL } from '../factory/constants.ts'

/** How long a piece takes to settle onto the table, in seconds. */
const SETTLE = 0.42

/** Sets its children down on the table after a delay, lowering them from just above, unless motion is reduced. */
export function Arrive({ delay, children }: { delay?: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const born = useRef(-1)
  useFrame(({ clock }) => {
    const piece = group.current
    // Without a delay the piece is already in place.
    if (!piece || delay === undefined) return
    if (born.current < 0) born.current = clock.elapsedTime
    const t = STILL ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - born.current - delay) / SETTLE))
    piece.visible = t > 0
    // Eased out, slowing as it nears the table; never below it, where the board would sink into the wood.
    piece.position.y = (1 - t) ** 3 * 0.45
  })
  return (
    <group ref={group} visible={STILL || delay === undefined}>
      {children}
    </group>
  )
}
