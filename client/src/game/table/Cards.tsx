import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { card, type Unit } from 'shared'
import * as THREE from 'three'
import { Disk, type DiskHandle } from './Disk.tsx'
import { backTexture, faceContent, faceLights, faceTexture, type CardStyle, type loadCardAssets } from './faces.ts'
import { CARD, DECK, HAND_SCALE, handPlace, slot, type Row, type Vec3 } from './layout.ts'
import { LEAVE_MS, type Lunge } from './playback.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

export type Place = { at: 'hand'; index: number; count: number } | { at: Row; lane: number }

export type Look = 'plain' | 'selected' | 'marked' | 'markable' | 'dim'

const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
const geometry = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth)
const EDGE = new THREE.MeshStandardMaterial({ color: '#2b211c' })

// Scratch objects, so the frame loop allocates nothing.
const position = new THREE.Vector3()
const rotation = new THREE.Quaternion()
const roll = new THREE.Quaternion()
const scale = new THREE.Vector3()
const Z = new THREE.Vector3(0, 0, 1)

const LUNGE_MS = 240

export function Card({
  unit,
  place,
  spawn,
  lunge,
  leavingAt,
  leavingHow = 'died',
  look = 'plain',
  assets,
  style = 'cabin',
  summoning,
  onClick,
}: {
  unit: Unit
  style?: CardStyle
  summoning?: boolean
  place: Place
  spawn?: Vec3
  lunge?: Lunge
  leavingAt?: number
  leavingHow?: 'died' | 'sacrificed'
  look?: Look
  assets: Assets
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}) {
  const mesh = useRef<THREE.Object3D>(null)
  const disk = useRef<DiskHandle>(null)
  const [hovered, setHovered] = useState(false)
  const placed = useRef(false)
  const face = faceTexture(unit, assets, style)
  const back = useMemo(() => backTexture(assets, style), [assets, style])
  const tech = style === 'tech'
  // On a tech card only the screen and the numerals glow, from their own map; a cabin card glows faintly all over.
  const rest = tech ? 1.1 : 0.22
  // Each card owns its materials so it can glow or fade alone; the textures are shared. The alpha test keeps the
  // clipped corner from writing depth where there is nothing to see.
  const [front, rear, content] = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: '#ffffff', transparent: true, alphaTest: 0.5 }),
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
  front.emissiveMap = tech ? null : face
  rear.map = back
  if (tech) {
    content.map = faceContent(unit, assets)
    content.emissiveMap = faceLights(unit, assets)
  }
  // A card drawn from the deck starts closed, as it lay in the deck, and opens on the way to the hand.
  const fromDeck = Boolean(tech && spawn && spawn[0] === DECK[0] && spawn[2] === DECK[2])
  const open = useRef(fromDeck ? 0 : 1)

  useFrame(({ camera }, delta) => {
    const card = mesh.current
    if (!card) return
    const now = performance.now()
    if (place.at === 'hand') {
      const { position: local, roll: angle } = handPlace(place.index, place.count, {
        selected: look === 'selected',
        hovered,
        summoning: summoning ?? false,
      })
      position.set(...local)
      camera.localToWorld(position)
      rotation.copy(camera.quaternion).multiply(roll.setFromAxisAngle(Z, angle))
      // A disk grows in the hand when picked up, as Act 3's do.
      scale.setScalar(HAND_SCALE * (tech && (hovered || look === 'selected') ? 1.25 : 1))
    } else {
      // A card marked for sacrifice lifts and tilts off the table, so the choice is plain to see.
      const lift = look === 'marked' ? 0.12 : hovered && onClick ? 0.04 : 0
      position.set(...slot(place.at, place.lane, lift))
      rotation.copy(FLAT)
      if (look === 'marked') rotation.multiply(roll.setFromAxisAngle(Z, 0.09))
      scale.setScalar(1)
    }
    if (lunge && now - lunge.at < LUNGE_MS)
      position.z += lunge.toward * 0.4 * Math.sin((Math.PI * (now - lunge.at)) / LUNGE_MS)
    const leaving = leavingAt === undefined ? 0 : Math.min(1, (now - leavingAt) / LEAVE_MS)
    if (leavingHow === 'sacrificed') {
      // Offered up: it rises, turns and shrinks away, where a death sinks into the table.
      position.y += leaving * 0.9
      rotation.multiply(roll.setFromAxisAngle(Z, leaving * 1.6))
      scale.multiplyScalar(1 - leaving * 0.6)
    } else position.y -= leaving * 0.45

    open.current = THREE.MathUtils.damp(open.current, 1, 9, delta)
    disk.current?.setOpen(open.current)
    if (!placed.current) {
      card.position.copy(spawn ? new THREE.Vector3(...spawn) : position)
      card.quaternion.copy(spawn ? FLAT : rotation)
      card.scale.copy(scale)
      placed.current = true
    }
    easing.damp3(card.position, position, 0.07, delta)
    easing.dampQ(card.quaternion, rotation, 0.07, delta)
    easing.damp3(card.scale, scale, 0.07, delta)

    // A card that can be sacrificed pulses red; a marked one holds it.
    const pulse = look === 'markable' ? 0.2 + 0.15 * Math.sin(now / 160) : 0
    const glow =
      look === 'selected'
        ? rest + 0.4
        : look === 'marked'
          ? rest + 0.2
          : look === 'markable'
            ? rest + pulse
            : hovered && onClick
              ? rest + 0.25
              : rest
    // A closing disk turns its display off: the screen's light goes first, then the drawing fades.
    // On a tech card the sticker and screens stay as it closes; what they show fades out, its light first.
    const shown = tech ? content : front
    shown.emissiveIntensity = glow * (tech ? open.current * open.current : 1)
    if (tech) front.emissiveIntensity = 0
    shown.emissive.set(look === 'marked' || look === 'markable' ? '#ff4040' : '#ffffff')
    front.color.setScalar(look === 'dim' ? 0.45 : 1)
    content.color.setScalar(look === 'dim' ? 0.45 : 1)
    front.opacity = rear.opacity = 1 - leaving
    content.opacity = (1 - leaving) * open.current
    // The alpha test discards the clear ground and, as the content fades, everything else too.
    content.alphaTest = Math.max(0.001, content.opacity * 0.5)
  })

  const handlers = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onClick?.(event)
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(true)
      if (onClick) document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      document.body.style.cursor = ''
    },
  }

  if (tech)
    return (
      <group ref={mesh} name={`card-${unit.uid}`} {...handlers}>
        <Disk
          ref={disk}
          open={fromDeck ? 0 : 1}
          kind={card(unit.card).tier === 'S' ? 'rare' : 'common'}
          front={front}
          content={content}
          back={rear}
        />
      </group>
    )

  return (
    <mesh
      ref={mesh as RefObject<THREE.Mesh>}
      name={`card-${unit.uid}`}
      geometry={geometry}
      material={[EDGE, EDGE, EDGE, EDGE, front, rear]}
      {...handlers}
    />
  )
}

/** A number rising off the table and fading: damage, healing, or a note such as overkill. */
export function Popup({
  text,
  tone,
  position: at,
  born,
}: {
  text: string
  tone: string
  position: Vec3
  born: number
}) {
  const sprite = useRef<THREE.Sprite>(null)
  const material = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = 256
    element.height = 96
    const context = element.getContext('2d') as CanvasRenderingContext2D
    context.font = '72px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 8
    context.strokeStyle = '#0a0e0a'
    context.strokeText(text, 128, 50)
    context.fillStyle = tone === 'heal' ? '#7dff9a' : tone === 'note' ? '#f2c14e' : '#ff5a4f'
    context.fillText(text, 128, 50)
    context.globalCompositeOperation = 'destination-out'
    context.fillStyle = 'rgb(0 0 0 / 0.4)'
    for (let line = 1; line < 96; line += 3) context.fillRect(0, line, 256, 1)
    const map = new THREE.CanvasTexture(element)
    map.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false })
  }, [text, tone])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  useFrame(() => {
    if (!sprite.current) return
    const t = Math.min(1, (performance.now() - born) / 1000)
    sprite.current.position.set(at[0], at[1] + t * 0.6, at[2])
    material.opacity = 1 - t * t
  })
  return <sprite ref={sprite} material={material} scale={[1.5, 0.56, 1]} renderOrder={10} />
}
