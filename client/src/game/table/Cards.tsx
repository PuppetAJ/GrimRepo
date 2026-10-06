import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Select } from '@react-three/postprocessing'
import { easing } from 'maath'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Unit } from 'shared'
import * as THREE from 'three'
import { useBatch } from './Batch.tsx'
import { claimCursor, releaseCursor, type CursorKind } from './cursor.ts'
import { STILL } from './factory/constants.ts'
import { kindOf } from './kind.ts'
import { MOOD } from './mood.ts'
import { Disk, facePlanes, type DiskHandle } from './Disk.tsx'
import { backTexture, faceContent, faceLights, faceTexture, type loadCardAssets } from './faces.ts'
import { DECK, handPlace, slot, type Row, type Vec3 } from './layout.ts'
import { LEAVE_MS, LUNGE_MS, SLIDE_MS, type Lunge, type Slide } from './playback.ts'
import { holding, startHold } from './reading.ts'

export { Popup } from './Popup.tsx'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

export type Place = { at: 'hand'; index: number; count: number } | { at: Row; lane: number }

export type Look = 'plain' | 'selected' | 'marked' | 'markable' | 'dim'

const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

// Scratch objects, so the frame loop allocates nothing.
const position = new THREE.Vector3()
const rotation = new THREE.Quaternion()
const roll = new THREE.Quaternion()
const scale = new THREE.Vector3()
const Z = new THREE.Vector3(0, 0, 1)

export function Card({
  unit,
  place,
  spawn,
  lunge,
  slide,
  leavingAt,
  leavingHow = 'died',
  look = 'plain',
  assets,
  summoning,
  shake = 0,
  onClick,
  onHover,
  onHold,
  raised = false,
  cursor = 'point',
}: {
  unit: Unit
  summoning?: boolean
  /** Each increment shakes the card, as when an unplayable card is tried. */
  shake?: number
  place: Place
  spawn?: Vec3
  lunge?: Lunge
  /** A move along the row, which lifts the card over the lanes between. */
  slide?: Slide
  leavingAt?: number
  leavingHow?: 'died' | 'sacrificed'
  look?: Look
  assets: Assets
  /** `touch` is true for a finger, since a first tap only lifts a hand card. */
  onClick?: (event: ThreeEvent<MouseEvent>, touch: boolean) => void
  onHover?: (on: boolean) => void
  onHold?: (x: number, y: number) => void
  /** Shown as hovered, for a hand card tapped once on touch. */
  raised?: boolean
  cursor?: CursorKind
}) {
  const mesh = useRef<THREE.Object3D>(null)
  const disk = useRef<DiskHandle>(null)
  const [pointed, setPointed] = useState(false)
  const hovered = pointed || raised
  const touched = useRef(false)
  const cancelHold = useRef<(() => void) | null>(null)
  const endHold = () => {
    cancelHold.current?.()
    cancelHold.current = null
  }
  useEffect(() => endHold, [])
  const self = useRef({})
  const clickable = Boolean(onClick)
  useEffect(() => {
    if (hovered && clickable) claimCursor(self.current, cursor)
    else releaseCursor(self.current)
  }, [hovered, clickable, cursor])
  useEffect(() => () => releaseCursor(self.current), [])
  const placed = useRef(false)
  const face = faceTexture(unit, assets)
  const back = useMemo(() => backTexture(), [])
  // Per-card materials so each can glow or fade alone; alphaTest keeps the clipped corner out of the depth buffer.
  const [front, rear, content] = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ roughness: 0.85, transparent: true, alphaTest: 0.5 }),
      new THREE.MeshStandardMaterial({ roughness: 0.85, transparent: true, alphaTest: 0.5 }),
      new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: '#ffffff', transparent: true, alphaTest: 0.5 }),
    ],
    [],
  )
  useEffect(
    () => () => {
      front.dispose()
      rear.dispose()
      content.dispose()
    },
    [front, rear, content],
  )
  front.map = face
  rear.map = back
  content.map = faceContent(unit, assets)
  content.emissiveMap = faceLights(unit, assets)
  // A spawn at the deck means a draw, which starts closed and opens on the way to the hand.
  const fromDeck = Boolean(spawn && spawn[0] === DECK[0] && spawn[2] === DECK[2])
  const open = useRef(fromDeck ? 0 : 1)
  // Once open and at rest, the body joins the shared batch and only the face stays the card's own.
  const batch = useBatch()
  const kind = kindOf(unit)
  const [settled, setSettled] = useState(!fromDeck)
  const batched = Boolean(batch) && settled && leavingAt === undefined
  const seat = useRef(-1)
  useEffect(() => {
    if (!batched || !batch) return
    seat.current = batch.take(kind)
    return () => {
      batch.give(kind, seat.current)
      seat.current = -1
    }
  }, [batched, batch, kind])
  const shook = useRef(-Infinity)
  useEffect(() => {
    if (shake) shook.current = performance.now()
  }, [shake])

  useFrame(({ camera }, delta) => {
    const card = mesh.current
    if (!card) return
    const now = performance.now()
    if (place.at === 'hand') {
      const {
        position: local,
        roll: angle,
        scale: size,
      } = handPlace(place.index, place.count, {
        selected: look === 'selected',
        hovered,
        summoning: summoning ?? false,
      })
      position.set(...local)
      camera.localToWorld(position)
      const since = (now - shook.current) / 1000
      // Slow and wide enough to survive the easing below.
      const no = !STILL && since < 0.7 ? 0.28 * Math.sin(since * 30) * Math.exp(-since * 5) : 0
      rotation.copy(camera.quaternion).multiply(roll.setFromAxisAngle(Z, angle + no))
      scale.setScalar(size * (hovered || look === 'selected' ? 1.25 : 1))
    } else {
      const lift = look === 'marked' ? 0.12 : hovered && onClick ? 0.04 : 0
      position.set(...slot(place.at, place.lane, lift))
      rotation.copy(FLAT)
      if (look === 'marked') rotation.multiply(roll.setFromAxisAngle(Z, 0.09))
      scale.setScalar(1)
    }
    if (!STILL && lunge && now - lunge.at < LUNGE_MS)
      position.z += lunge.toward * 0.4 * Math.sin((Math.PI * (now - lunge.at)) / LUNGE_MS)
    const sliding = !STILL && slide !== undefined && now - slide.at < SLIDE_MS
    // Lifted off the table in an arc while it crosses, so the move reads as one.
    if (sliding) position.y += Math.sin((Math.PI * (now - slide.at)) / SLIDE_MS) * 0.3
    const leaving = leavingAt === undefined ? 0 : Math.min(1, (now - leavingAt) / LEAVE_MS)
    const fold = THREE.MathUtils.smoothstep(leaving, 0, 0.45)
    const away = THREE.MathUtils.smoothstep(leaving, 0.4, 1)
    // With reduced motion a leaving card folds shut where it stands instead of flying off.
    if (!STILL && leavingHow === 'sacrificed') {
      position.y += away * 0.9
      rotation.multiply(roll.setFromAxisAngle(Z, away * 1.6))
      scale.multiplyScalar(1 - away * 0.95)
    } else if (!STILL) {
      // A dead card slides toward its owner's side of the table.
      position.z += away * 1.6 * (place.at === 'board' ? 1 : -1)
      position.y += Math.sin(away * Math.PI) * 0.12
      scale.multiplyScalar(1 - THREE.MathUtils.smoothstep(away, 0.5, 1) * 0.95)
    }
    // The plastic can't fade, so a gone card is hidden instead.
    card.visible = leaving < 1

    open.current = leavingAt === undefined ? THREE.MathUtils.damp(open.current, 1, 9, delta) : 1 - fold
    if (fromDeck && leavingAt === undefined && open.current < 0.995) {
      const arc = Math.sin(open.current * Math.PI)
      position.y += arc * 0.3
      scale.multiplyScalar(1 + arc * 0.12)
    }
    disk.current?.setOpen(open.current)
    if (!placed.current) {
      card.position.copy(spawn ? new THREE.Vector3(...spawn) : position)
      card.quaternion.copy(spawn ? FLAT : rotation)
      card.scale.copy(scale)
      placed.current = true
    }
    easing.damp3(card.position, position, sliding ? 0.12 : 0.07, delta)
    easing.dampQ(card.quaternion, rotation, 0.07, delta)
    easing.damp3(card.scale, scale, 0.07, delta)
    if (!settled && open.current > 0.995) setSettled(true)
    if (batched && batch && seat.current >= 0) {
      card.updateMatrix()
      batch.place(kind, seat.current, card.matrix, look === 'dim' ? 0.45 : 1)
    }

    const rest = MOOD.cardGlow
    const pulse = look === 'markable' ? 0.12 + 0.1 * Math.sin(now / 160) : 0
    const glow =
      look === 'selected'
        ? rest + 0.25
        : look === 'marked'
          ? rest + 0.15
          : look === 'markable'
            ? rest + pulse
            : hovered && onClick
              ? rest + 0.15
              : rest
    // Squared so the glow dies before the content fades as the disk closes.
    content.emissiveIntensity = glow * open.current * open.current
    content.emissive.set(look === 'marked' || look === 'markable' ? '#ff4040' : '#ffffff')
    front.color.setScalar(look === 'dim' ? 0.45 : 1)
    content.color.setScalar(look === 'dim' ? 0.45 : 1)
    front.opacity = rear.opacity = 1 - away
    content.opacity = (1 - away) * open.current
    // Raising alphaTest with the fade discards the fading content along with the clear ground.
    content.alphaTest = Math.max(0.001, content.opacity * 0.5)
  })

  const handlers = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      // A hold was for reading, not playing.
      if (holding()) return
      onClick?.(event, touched.current)
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      touched.current = event.pointerType === 'touch'
      if (!onHold || (!touched.current && event.button !== 0)) return
      endHold()
      cancelHold.current = startHold(event, onHold)
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setPointed(true)
      onHover?.(true)
    },
    onPointerOut: () => {
      setPointed(false)
      onHover?.(false)
    },
    // Stop here too, or whatever lies behind the card is hovered again on the next move.
    onPointerMove: (event: ThreeEvent<PointerEvent>) => event.stopPropagation(),
  }

  return (
    <group ref={mesh} name={`card-${unit.uid}`} {...handlers}>
      {batched ? (
        // Select tags it for the card glow; a moving card stays untagged until it settles.
        <Select enabled>
          <mesh geometry={facePlanes().content} material={content} />
        </Select>
      ) : (
        <Disk ref={disk} open={fromDeck ? 0 : 1} kind={kind} front={front} content={content} back={rear} />
      )}
    </group>
  )
}
