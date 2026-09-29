import { Sparkles, useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { View } from '../view.ts'
import { Battery } from './factory/Battery.tsx'
import { DUST, lamp, STILL, X } from './factory/constants.ts'
import { Monitor } from './factory/Monitor.tsx'
import { logLines, statusLines } from './factory/monitorLines.ts'
import { DrumRack, GemModule, Lamp, Props } from './factory/Props.tsx'
import { Room } from './factory/Room.tsx'
import { surfaces } from './factory/surfaces.ts'
import { TABLE_Y, type Vec3 } from './layout.ts'
import { MOOD } from './mood.ts'
import { TINT } from './palette.ts'
import type { Screen } from './reading.ts'

export { EndTurnButton } from './factory/EndTurnButton.tsx'
export { FactoryEffects } from './factory/FactoryEffects.tsx'
export { logLines, statusLines } from './factory/monitorLines.ts'
export { FactoryP03 } from './factory/P03.tsx'
export { Scale } from './factory/Scale.tsx'
export { TechBoard } from './factory/TechBoard.tsx'

// P03's factory, after Inscryption's Act 3: dark metal lit by P03's green screens. Built here in code.

/** Everything around the table: the room, the light, the screens and the props. */
export function Factory({
  view,
  log,
  onHold,
  onPin,
}: {
  view: View
  log: string[]
  /** Told when a screen is clicked or tapped, which pins its readout open. */
  onPin?: (screen: Screen) => void
  /** Told when a finger or the mouse's button has held a screen, and where. */
  onHold?: (screen: Screen, x: number, y: number) => void
}) {
  const lines = useMemo(() => logLines(log), [log])
  const status = useMemo(
    () => statusLines({ scale: view.scale, turn: view.turn, deck: view.deck }),
    [view.scale, view.turn, view.deck],
  )
  return (
    <>
      <fog attach="fog" args={[TINT.fog, MOOD.fogNear, MOOD.fogFar]} />
      <ambientLight color={TINT.ambient} intensity={MOOD.ambient} />
      <hemisphereLight color={TINT.hemisphere} groundColor="#000000" intensity={MOOD.hemisphere} />
      {/* A little light over the deck and the pile, and over the player's hands. */}
      <pointLight
        color={lamp(TINT.cool, MOOD.lampTint)}
        position={[X + 3.3, TABLE_Y + 2.2, -8.6]}
        intensity={MOOD.deckLight}
        distance={7}
        decay={1.8}
      />
      <pointLight
        color={lamp(TINT.fill, MOOD.lampTint)}
        position={[X, TABLE_Y + 1.6, -5.2]}
        intensity={MOOD.handLight}
        distance={6}
        decay={2}
      />
      {/* A cool lamp over the board, so the cards read. */}
      <spotLight
        color={lamp(TINT.spot, MOOD.lampTint)}
        position={[X, 13, -8.2]}
        target-position={[X, TABLE_Y, -10.2]}
        angle={0.5}
        penumbra={0.6}
        intensity={MOOD.spot}
        decay={1.6}
        distance={20}
      />
      <Fixtures />
      <Monitor screen="log" position={LOG_AT} turn={0.3} lines={lines} onHold={onHold} onPin={onPin} />
      <Monitor screen="status" position={STATUS_AT} turn={-0.3} lines={status} onHold={onHold} onPin={onPin} />
      <Suspense fallback={null}>
        <Battery view={view} />
      </Suspense>
    </>
  )
}

const LOG_AT: Vec3 = [X - 4.3, 9.5, -14.2]
const STATUS_AT: Vec3 = [X + 4.3, 9.5, -14.2]

/** Everything in the room that no move changes, kept out of the re-render each move brings. */
const Fixtures = memo(function Fixtures() {
  // The dust is drawn as at 1x whatever the resolution, so it looks the same when the resolution adapts.
  const dust = useRef<THREE.Points>(null)
  useFrame(() => {
    const material = dust.current?.material as { pixelRatio?: number } | undefined
    if (material) material.pixelRatio = 1
  })
  return (
    <>
      <Room />
      <Lamp />
      <DrumRack />
      <Props />
      <Suspense fallback={null}>
        <GemModule />
      </Suspense>
      {/* Dust drifting in the light, hanging still for anyone who asks for less motion. */}
      <Sparkles
        ref={dust}
        count={MOOD.dustCount}
        scale={[14, 7, 12]}
        position={[X, 8.5, -11]}
        size={MOOD.dustSize}
        speed={STILL ? 0 : MOOD.dustSpeed}
        color={DUST}
        opacity={MOOD.dustOpacity}
      />
    </>
  )
})

// Fetched as soon as the table's code arrives, alongside the card art, rather than as each part first renders.
for (const url of [
  '/models/p03.glb',
  '/models/battery.glb',
  '/models/hammer.glb',
  '/models/pliers.glb',
  '/models/light.glb',
  '/models/button.glb',
])
  useGLTF.preload(url, false, false)
for (const name of ['table', 'floor', 'wall']) useTexture.preload(Object.values(surfaces(name)))
