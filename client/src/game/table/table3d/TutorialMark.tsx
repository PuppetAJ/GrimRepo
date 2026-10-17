import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { CARD, type Vec3 } from '../layout.ts'
import { STILL } from '../factory/constants.ts'

/** The tutorial's mark, white and dotted like the text table's, its dots marching so it reads at a glance. */
function Frame({ width, height, plane }: { width: number; height: number; plane: 'flat' | 'upright' }) {
  const line = useRef<{ material: { dashOffset: number } }>(null)
  useFrame((_, delta) => {
    if (line.current && !STILL) line.current.material.dashOffset -= delta * 0.25
  })
  const [w, h] = [width / 2, height / 2]
  const corners: Vec3[] =
    plane === 'flat'
      ? [
          [-w, 0, -h],
          [w, 0, -h],
          [w, 0, h],
          [-w, 0, h],
          [-w, 0, -h],
        ]
      : [
          [-w, -h, 0],
          [w, -h, 0],
          [w, h, 0],
          [-w, h, 0],
          [-w, -h, 0],
        ]
  return (
    <Line
      ref={line as never}
      points={corners}
      color="#ffffff"
      lineWidth={3}
      dashed
      dashSize={0.06}
      gapSize={0.05}
      depthTest={false}
      renderOrder={10}
    />
  )
}

/** Flat on the table around a place, such as the deck, the pile or the button. */
export function TableMark({ at, width, depth }: { at: Vec3; width: number; depth: number }) {
  return (
    <group position={[at[0], at[1] + 0.01, at[2]]}>
      <Frame width={width} height={depth} plane="flat" />
    </group>
  )
}

/** Around a card, in the card's own space, so it follows the card into the hand or across the board. */
export function CardMark() {
  return (
    <group position={[0, 0, CARD.depth]}>
      <Frame width={CARD.width * 1.14} height={CARD.height * 1.1} plane="upright" />
    </group>
  )
}
