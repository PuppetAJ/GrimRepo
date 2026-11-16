import { CardMark } from './table3d/TutorialMark.tsx'
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
import { backTexture, faceContent, faceLights, faceTexture, holdFaces, type loadCardAssets } from './faces.ts'
import { DECK, handPlace, LANE_GAP, slot, type Row, type Vec3 } from './layout.ts'
import { LEAVE_MS, LUNGE_MS, SLIDE_MS, type Lunge, type Slide } from './playback.ts'
import { holding, startHold } from './reading.ts'

export { Popup } from './Popup.tsx'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

export type Place = { at: 'hand'; index: number; count: number; lowered?: boolean } | { at: Row; lane: number }

export type Look = 'plain' | 'selected' | 'marked' | 'markable' | 'aimable' | 'dim'

const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

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
  tutorialMark = false,
}: {
  unit: Unit
  summoning?: boolean
  shake?: number
  place: Place
  spawn?: Vec3
  lunge?: Lunge
  slide?: Slide
  leavingAt?: number
  leavingHow?: 'died' | 'sacrificed'
  look?: Look
  assets: Assets
  onClick?: (event: ThreeEvent<MouseEvent>, touch: boolean) => void
  onHover?: (on: boolean) => void
  onHold?: (x: number, y: number, sticky?: boolean) => void
  raised?: boolean
  cursor?: CursorKind
  tutorialMark?: boolean
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
  // alphaTest keeps the clipped corner out of the depth buffer.
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
  const words = faceContent(unit, assets)
  const glow = faceLights(unit, assets)
  useEffect(() => holdFaces(words, glow), [words, glow])
  front.map = face
  rear.map = back
  content.map = words
  content.emissiveMap = glow
  const fromDeck = Boolean(spawn && spawn[0] === DECK[0] && spawn[2] === DECK[2])
  const open = useRef(fromDeck ? 0 : 1)
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
        lowered: place.lowered ?? false,
      })
      position.set(...local)
      camera.localToWorld(position)
      const since = (now - shook.current) / 1000
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
    if (!STILL && lunge && now - lunge.at < LUNGE_MS) {
      const swing = Math.sin((Math.PI * (now - lunge.at)) / LUNGE_MS)
      position.z += lunge.toward * 0.4 * swing
      position.x += lunge.across * LANE_GAP * 0.45 * swing
    }
    const sliding = !STILL && slide !== undefined && now - slide.at < SLIDE_MS
    if (sliding) position.y += Math.sin((Math.PI * (now - slide.at)) / SLIDE_MS) * 0.3
    const leaving = leavingAt === undefined ? 0 : Math.min(1, (now - leavingAt) / LEAVE_MS)
    const fold = THREE.MathUtils.smoothstep(leaving, 0, 0.45)
    const away = THREE.MathUtils.smoothstep(leaving, 0.4, 1)
    if (!STILL && leavingHow === 'sacrificed') {
      position.y += away * 0.9
      rotation.multiply(roll.setFromAxisAngle(Z, away * 1.6))
      scale.multiplyScalar(1 - away * 0.95)
    } else if (!STILL) {
      position.z += away * 1.6 * (place.at === 'board' ? 1 : -1)
      position.y += Math.sin(away * Math.PI) * 0.12
      scale.multiplyScalar(1 - THREE.MathUtils.smoothstep(away, 0.5, 1) * 0.95)
    }
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
    const pulse = look === 'markable' || look === 'aimable' ? 0.12 + 0.1 * Math.sin(now / 160) : 0
    const glow =
      look === 'selected'
        ? rest + 0.25
        : look === 'marked'
          ? rest + 0.15
          : look === 'markable' || look === 'aimable'
            ? rest + pulse
            : hovered && onClick
              ? rest + 0.15
              : rest
    content.emissiveIntensity = glow * open.current * open.current
    content.emissive.set(
      look === 'marked' || look === 'markable' ? '#ff4040' : look === 'aimable' ? '#ffb454' : '#ffffff',
    )
    front.color.setScalar(look === 'dim' ? 0.45 : 1)
    content.color.setScalar(look === 'dim' ? 0.45 : 1)
    front.opacity = rear.opacity = 1 - away
    content.opacity = (1 - away) * open.current
    content.alphaTest = Math.max(0.001, content.opacity * 0.5)
  })

  const handlers = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (holding()) return
      onClick?.(event, touched.current)
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      touched.current = event.pointerType === 'touch'
      if (!onHold || (!touched.current && event.button !== 0)) return
      endHold()
      cancelHold.current = startHold(event, onHold)
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onContextMenu: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onHold?.(event.nativeEvent.clientX, event.nativeEvent.clientY, true)
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setPointed(true)
      onHover?.(true)
    },
    onPointerOut: () => {
      setPointed(false)
      onHover?.(false)
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => event.stopPropagation(),
  }

  return (
    <group ref={mesh} name={`card-${unit.uid}`} {...handlers}>
      {batched ? (
        <Select enabled>
          <mesh geometry={facePlanes().content} material={content} />
        </Select>
      ) : (
        <Disk ref={disk} open={fromDeck ? 0 : 1} kind={kind} front={front} content={content} back={rear} />
      )}
      {tutorialMark ? <CardMark /> : null}
    </group>
  )
}
