import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { STILL } from '../factory/constants.ts'

/** How long a piece takes to settle onto the table, or to lift off it, in seconds. */
export const SETTLE = 0.42

/**
 * Sets its children down on the table after a delay, lowering them from just above, and lifts them away when it
 * `leave`s, unless motion is reduced. Without a delay they start in place.
 */
export function Arrive({ delay, leave = false, children }: { delay?: number; leave?: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const born = useRef(-1)
  const gone = useRef(-1)
  useFrame(({ clock }) => {
    const piece = group.current
    if (!piece) return
    const now = clock.elapsedTime
    if (born.current < 0) born.current = now
    if (leave && gone.current < 0) gone.current = now
    if (!leave) gone.current = -1
    const down = STILL || delay === undefined ? 1 : Math.min(1, Math.max(0, (now - born.current - delay) / SETTLE))
    const up = gone.current < 0 ? 0 : STILL ? 1 : Math.min(1, (now - gone.current) / SETTLE)
    piece.visible = down > 0 && up < 1
    // Eased out as it settles and in as it lifts; never below the table, where the board would sink into the wood.
    piece.position.y = ((1 - down) ** 3 + up ** 3) * 0.45
  })
  return (
    <group ref={group} visible={STILL || delay === undefined}>
      {children}
    </group>
  )
}
