import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TIP } from 'shared'
import * as THREE from 'three'
import type { View } from '../../view.ts'
import { MOOD } from '../mood.ts'
import { TINT } from '../palette.ts'
import { CENTER_X } from '../layout.ts'
import { LIT, STILL } from './constants.ts'

// Smug reuses the happy face texture.
type Mood = 'smug' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'
const MOODS = ['happy', 'impatient', 'choking', 'dying', 'whiteflag'] as const
type Face = (typeof MOODS)[number]

const FACE_GLOW = 1.6
/** Seconds for a face to flicker out, then for the next to flicker in. */
const FACE_OUT = 0.12
const FACE_IN = 0.2

let faces: Promise<Record<Face, THREE.Texture>> | null = null

// White on black, so the screen's emissive color tints them.
function loadFaces(): Promise<Record<Face, THREE.Texture>> {
  const loader = new THREE.TextureLoader()
  faces ??= Promise.all(
    MOODS.map(async (mood): Promise<[Face, THREE.Texture]> => {
      const texture = await loader.loadAsync(`/p03/screen/${mood}.png`)
      // The pack stores its faces upside down.
      texture.flipY = true
      texture.colorSpace = THREE.SRGBColorSpace
      texture.magFilter = THREE.NearestFilter
      return [mood, texture]
    }),
  ).then((entries) => Object.fromEntries(entries) as Record<Face, THREE.Texture>)
  return faces
}

function useMood(view: View, busy: boolean, outcome: 'win' | 'loss' | undefined): Mood {
  const [choking, setChoking] = useState(false)
  const [impatient, setImpatient] = useState(false)
  const scale = view.scale
  const last = useRef(scale)
  useEffect(() => {
    const hit = scale - last.current
    last.current = scale
    if (hit < 4) return
    const start = setTimeout(() => setChoking(true), 0)
    setTimeout(() => setChoking(false), 1600)
    return () => clearTimeout(start)
  }, [scale])
  useEffect(() => {
    const calm = setTimeout(() => setImpatient(false), 0)
    const waiting = busy ? undefined : setTimeout(() => setImpatient(true), 25_000)
    return () => {
      clearTimeout(calm)
      clearTimeout(waiting)
    }
  }, [view, busy])
  if (outcome === 'win') return 'whiteflag'
  if (outcome === 'loss') return 'happy'
  if (choking) return 'choking'
  if (scale >= TIP - 6) return 'dying'
  if (impatient) return 'impatient'
  return 'smug'
}

/** P03 V2 by p03_real_account, with no clips of its own, so it idles here: its head bobs, its cranks turn and its claw snaps. */
function P03({ mood }: { mood: Mood }) {
  const { scene } = useGLTF('/models/p03.glb', false, false)
  const textures = use(loadFaces())
  const parts = useMemo(() => {
    const part = (name: string) => {
      const object = scene.getObjectByName(name) as THREE.Object3D
      object.userData['rest'] ??= { position: object.position.clone(), rotation: object.rotation.clone() }
      return object
    }
    return {
      head: part('HeadRig'),
      arm: part('ArmRig'),
      headCrank: part('Head-Crank'),
      armCrank: part('ArmLeft-Crank'),
      clawLeft: part('ArmRight-ClawLeft'),
      clawRight: part('ArmRight-ClawRight'),
    }
  }, [scene])
  const face = mood === 'smug' ? 'happy' : mood
  const screen = useRef<THREE.MeshStandardMaterial | null>(null)
  // Set up once; after that the face changes in the frame loop, so it can flicker across.
  useLayoutEffect(() => {
    const material = (scene.getObjectByName('Head-RenderTargetPlane') as THREE.Mesh)
      .material as THREE.MeshStandardMaterial
    // Emissive only, so no light in the room can shade half the face.
    material.map = null
    material.color.set('#000000')
    material.alphaTest = 0
    material.emissive.set(LIT)
    // Any face, so the shader is built with one; the frame loop puts on the right one.
    material.emissiveMap = textures.happy
    material.emissiveIntensity = FACE_GLOW
    material.needsUpdate = true
    screen.current = material
  }, [scene, textures])
  const swap = useRef({ face: null as Face | null, at: -1 })
  useFrame(({ clock }) => {
    // A new face flickers in like a screen changing channel, rather than snapping.
    const material = screen.current
    const change = swap.current
    if (material) {
      const now = clock.elapsedTime
      if (change.face === null || STILL) {
        material.emissiveMap = textures[face]
        change.face = face
      } else if (change.face !== face && change.at < 0) change.at = now
      if (change.at >= 0) {
        const since = now - change.at
        if (since >= FACE_OUT && change.face !== face) {
          material.emissiveMap = textures[face]
          change.face = face
        }
        const level = since < FACE_OUT ? 1 - since / FACE_OUT : Math.min(1, (since - FACE_OUT) / FACE_IN)
        material.emissiveIntensity = FACE_GLOW * level * (Math.random() < 0.3 ? 0.4 : 1)
        if (since >= FACE_OUT + FACE_IN) {
          material.emissiveIntensity = FACE_GLOW
          change.at = -1
        }
      }
    }
    // Frozen at the rest pose with reduced motion; the mood's droop still shows.
    const t = STILL ? 0 : clock.getElapsedTime()
    const rest = (object: THREE.Object3D) =>
      object.userData['rest'] as { position: THREE.Vector3; rotation: THREE.Euler }
    const { head, arm, headCrank, armCrank, clawLeft, clawRight } = parts
    // The model faces +x, so it nods about z and turns about y.
    const droop = mood === 'dying' || mood === 'whiteflag' ? -0.14 : 0
    const shake = mood === 'choking' ? Math.sin(t * 42) * 0.05 : 0
    const bounce = mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.08 : 0
    head.position.y = rest(head).position.y + Math.sin(t * 1.1) * 0.04 + bounce
    head.rotation.z = rest(head).rotation.z + Math.sin(t * 0.6) * 0.03 + droop
    head.rotation.y = rest(head).rotation.y + Math.sin(t * 0.37) * 0.07 + shake
    headCrank.rotation.z = rest(headCrank).rotation.z + t * 0.8
    // The arm's crank rocks rather than spins, since a full turn swings its grip through the body.
    armCrank.rotation.z = rest(armCrank).rotation.z + Math.sin(t * 0.7) * 0.35
    arm.rotation.z = rest(arm).rotation.z + Math.sin(t * 0.8) * 0.06
    const snap = Math.max(0, Math.sin(t * 1.3)) ** 8 * 0.35
    clawLeft.rotation.x = rest(clawLeft).rotation.x + snap
    clawRight.rotation.x = rest(clawRight).rotation.x - snap
  })
  return <primitive object={scene} position={[CENTER_X, 9.06, -16]} rotation={[0, -Math.PI / 2, 0]} />
}

export function FactoryP03({ view, busy, outcome }: { view: View; busy: boolean; outcome?: 'win' | 'loss' }) {
  const mood = useMood(view, busy, outcome)
  return (
    <>
      <P03 mood={mood} />
      <pointLight
        color={TINT.light}
        position={[CENTER_X, 10.4, -13.4]}
        intensity={MOOD.p03Light}
        distance={10}
        decay={1.6}
      />
    </>
  )
}
