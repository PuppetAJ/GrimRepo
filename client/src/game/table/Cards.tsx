import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Unit } from 'shared'
import * as THREE from 'three'
import { backTexture, faceTexture, shutterTexture, TECH_SCREEN, type CardStyle, type loadCardAssets } from './faces.ts'
import { CARD, HAND_SCALE, handPlace, slot, type Row, type Vec3 } from './layout.ts'
import { LEAVE_MS, type Lunge } from './playback.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

export type Place = { at: 'hand'; index: number; count: number } | { at: Row; lane: number }

export type Look = 'plain' | 'selected' | 'marked' | 'markable' | 'dim'

const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
const geometry = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth)
const EDGE = new THREE.MeshStandardMaterial({ color: '#2b211c' })
const TECH_EDGE = new THREE.MeshStandardMaterial({ color: '#0f1c28', metalness: 0.6, roughness: 0.5 })
// The floppy's shutter, hung from the top of the screen so it can roll up out of the way.
const SHUTTER = {
  height: CARD.height * (TECH_SCREEN.bottom - TECH_SCREEN.top),
  top: CARD.height * (0.5 - TECH_SCREEN.top),
}
const shutterGeometry = new THREE.PlaneGeometry(CARD.width, SHUTTER.height).translate(0, -SHUTTER.height / 2, 0)

// Scratch objects, so the frame loop allocates nothing.
const position = new THREE.Vector3()
const rotation = new THREE.Quaternion()
const roll = new THREE.Quaternion()
const scale = new THREE.Vector3()
const Z = new THREE.Vector3(0, 0, 1)

const LUNGE_MS = 300

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
  const mesh = useRef<THREE.Mesh>(null)
  const shutter = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const placed = useRef(false)
  const face = faceTexture(unit, assets, style)
  const back = useMemo(() => backTexture(assets, style), [assets, style])
  // Tech cards are screens, so they give off more of their own light.
  const rest = style === 'tech' ? 0.5 : 0.22
  // Each card owns its materials so it can glow or fade alone; the textures are shared.
  const [front, rear] = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: '#ffffff', transparent: true }),
      new THREE.MeshStandardMaterial({ roughness: 0.85, transparent: true }),
    ],
    [],
  )
  useEffect(
    () => () => {
      front.dispose()
      rear.dispose()
    },
    [front, rear],
  )
  front.map = face
  front.emissiveMap = face
  rear.map = back
  const tech = style === 'tech'
  const shutterMaterial = useMemo(
    // It glows a little of its own, since the hand sits far from the factory's lamps.
    () =>
      tech
        ? new THREE.MeshStandardMaterial({
            map: shutterTexture(),
            emissiveMap: shutterTexture(),
            emissive: '#ffffff',
            emissiveIntensity: 0.55,
            roughness: 0.55,
            metalness: 0.5,
          })
        : null,
    [tech],
  )
  useEffect(() => () => shutterMaterial?.dispose(), [shutterMaterial])

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
      scale.setScalar(HAND_SCALE)
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

    if (!placed.current) {
      card.position.copy(spawn ? new THREE.Vector3(...spawn) : position)
      card.quaternion.copy(spawn ? FLAT : rotation)
      card.scale.copy(scale)
      placed.current = true
    }
    easing.damp3(card.position, position, 0.1, delta)
    easing.dampQ(card.quaternion, rotation, 0.1, delta)
    easing.damp3(card.scale, scale, 0.1, delta)

    // A card that can be sacrificed pulses red; a marked one holds it.
    const pulse = look === 'markable' ? 0.2 + 0.15 * Math.sin(now / 160) : 0
    const glow =
      look === 'selected'
        ? rest + 0.3
        : look === 'marked'
          ? 0.4
          : look === 'markable'
            ? pulse
            : hovered && onClick
              ? rest + 0.18
              : rest
    front.emissiveIntensity = glow
    front.emissive.set(look === 'marked' || look === 'markable' ? '#ff4040' : '#ffffff')
    front.color.setScalar(look === 'dim' ? 0.45 : 1)
    front.opacity = rear.opacity = 1 - leaving

    // A disk in the hand stays shut; picking it up, or playing it, rolls the shutter up off the screen.
    if (shutter.current) {
      const open = place.at !== 'hand' || hovered || look === 'selected'
      easing.damp(shutter.current.scale, 'y', open ? 0.04 : 1, 0.12, delta)
    }
  })

  return (
    <mesh
      ref={mesh}
      name={`card-${unit.uid}`}
      geometry={geometry}
      material={
        tech ? [TECH_EDGE, TECH_EDGE, TECH_EDGE, TECH_EDGE, front, rear] : [EDGE, EDGE, EDGE, EDGE, front, rear]
      }
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        if (onClick) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      {shutterMaterial ? (
        <mesh
          ref={shutter}
          geometry={shutterGeometry}
          material={shutterMaterial}
          position={[0, SHUTTER.top, CARD.depth / 2 + 0.002]}
          raycast={() => null}
        />
      ) : null}
    </mesh>
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
