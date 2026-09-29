import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Action } from 'shared'
import { laneAction } from '../../controls.tsx'
import type { View } from '../../view.ts'
import { claimCursor, releaseCursor } from '../cursor.ts'
import { BOARD_DEPTH, CARD, lanes, slot, TABLE_Y } from '../layout.ts'
import { TINT } from '../palette.ts'

/** Glows over the player's lanes that can take a click, and catches the click on empty ones. */
// Just outside the slot, so it still shows around a card lifted to be sacrificed.
const OUTLINE_W = CARD.width * 1.24
const OUTLINE_H = CARD.height * 1.16

/** A dashed outline crawling round the slot the pointer is over, so the target is plain whatever sits in it. */
function TargetOutline({ lane, colour }: { lane: number; colour: string }) {
  const line = useRef<{ material: { dashOffset: number } }>(null)
  const [x, , z] = slot('board', lane)
  const [w, h] = [OUTLINE_W / 2, OUTLINE_H / 2]
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * 0.25
  })
  return (
    <Line
      ref={line as never}
      points={[
        [x - w, 0, z - h],
        [x + w, 0, z - h],
        [x + w, 0, z + h],
        [x - w, 0, z + h],
        [x - w, 0, z - h],
      ]}
      position={[0, TABLE_Y + BOARD_DEPTH + 0.006, 0]}
      color={colour}
      lineWidth={4}
      dashed
      dashSize={0.07}
      gapSize={0.045}
    />
  )
}

export function Lanes({
  view,
  legal,
  act,
  play,
  aimed: hovered,
  onAim: setHovered,
}: {
  view: View
  legal: Action[]
  act: (action: Action) => void
  play: string
  /** The lane the pointer is over, whether on the lane or on the card in it. */
  aimed: number | null
  onAim: (lane: number | null) => void
}) {
  const target = hovered === null ? null : laneAction(legal, hovered)
  const self = useRef({})
  const aiming = target ? (target.type === 'place' ? 'point' : 'mark') : null
  useEffect(() => {
    if (aiming) claimCursor(self.current, aiming)
    else releaseCursor(self.current)
  }, [aiming])
  return (
    <>
      {target && hovered !== null ? (
        <TargetOutline lane={hovered} colour={target.type === 'place' ? TINT.glow : '#ff4a3d'} />
      ) : null}
      {lanes.map((lane) => {
        const action = laneAction(legal, lane)
        const marked = view.summon?.marked.includes(lane) ?? false
        const [x, , z] = slot('board', lane)
        const colour = action?.type === 'place' ? play : '#ff4a3d'
        return (
          <mesh
            key={lane}
            name={`lane-${lane}`}
            position={[x, TABLE_Y + BOARD_DEPTH + 0.002, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(event) => {
              event.stopPropagation()
              if (action) act(action)
            }}
            onPointerOver={() => setHovered(lane)}
            onPointerOut={() => setHovered(null)}
          >
            <planeGeometry args={[CARD.width * 1.12, CARD.height * 1.08]} />
            <meshBasicMaterial
              color={colour}
              transparent
              opacity={marked ? 0.5 : action ? (hovered === lane ? 0.65 : 0.4) : 0}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </>
  )
}
