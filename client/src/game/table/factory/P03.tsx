import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { use, useLayoutEffect, useMemo, useRef } from 'react'
import type { Face as ScriptedFace } from 'shared'
import { useP03Face } from '../../mood.ts'
import * as THREE from 'three'
import type { View } from '../../view.ts'
import { MOOD } from '../mood.ts'
import { TINT } from '../palette.ts'
import { CENTER_X } from '../layout.ts'
import { LIT, STILL } from './constants.ts'

type Mood = 'smug' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'
const MOODS = ['neutral', 'happy', 'impatient', 'choking', 'dying', 'whiteflag'] as const
type Face = (typeof MOODS)[number]

const FACE_GLOW = 1.6
const FACE_OUT_SECONDS = 0.12
const FACE_IN_SECONDS = 0.2

function compileWithEmissiveMap(material: THREE.MeshStandardMaterial, map: THREE.Texture): void {
  material.emissiveMap = map
}

let faces: Promise<Record<Face, THREE.Texture>> | null = null

function loadFaces(): Promise<Record<Face, THREE.Texture>> {
  const loader = new THREE.TextureLoader()
  faces ??= Promise.all(
    MOODS.map(async (mood): Promise<[Face, THREE.Texture]> => {
      const texture = await loader.loadAsync(`/p03/screen/${mood}.png`)
      texture.flipY = true
      texture.colorSpace = THREE.SRGBColorSpace
      texture.magFilter = THREE.NearestFilter
      return [mood, texture]
    }),
  ).then((entries) => Object.fromEntries(entries) as Record<Face, THREE.Texture>)
  return faces
}

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
  const face = mood === 'smug' ? 'neutral' : mood
  const screen = useRef<THREE.MeshStandardMaterial | null>(null)
  useLayoutEffect(() => {
    const material = (scene.getObjectByName('Head-RenderTargetPlane') as THREE.Mesh)
      .material as THREE.MeshStandardMaterial
    material.map = null
    material.color.set('#000000')
    material.alphaTest = 0
    material.emissive.set(LIT)
    compileWithEmissiveMap(material, textures.neutral)
    material.emissiveIntensity = FACE_GLOW
    material.needsUpdate = true
    screen.current = material
  }, [scene, textures])
  const swap = useRef({ face: null as Face | null, at: -1 })
  useFrame(({ clock }) => {
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
        if (since >= FACE_OUT_SECONDS && change.face !== face) {
          material.emissiveMap = textures[face]
          change.face = face
        }
        const level =
          since < FACE_OUT_SECONDS
            ? 1 - since / FACE_OUT_SECONDS
            : Math.min(1, (since - FACE_OUT_SECONDS) / FACE_IN_SECONDS)
        material.emissiveIntensity = FACE_GLOW * level * (Math.random() < 0.3 ? 0.4 : 1)
        if (since >= FACE_OUT_SECONDS + FACE_IN_SECONDS) {
          material.emissiveIntensity = FACE_GLOW
          change.at = -1
        }
      }
    }
    const t = STILL ? 0 : clock.getElapsedTime()
    const rest = (object: THREE.Object3D) =>
      object.userData['rest'] as { position: THREE.Vector3; rotation: THREE.Euler }
    const { head, arm, headCrank, armCrank, clawLeft, clawRight } = parts
    const droop = mood === 'dying' || mood === 'whiteflag' ? -0.14 : 0
    const shake = mood === 'choking' ? Math.sin(t * 42) * 0.05 : 0
    const bounce = mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.08 : 0
    head.position.y = rest(head).position.y + Math.sin(t * 1.1) * 0.04 + bounce
    head.rotation.z = rest(head).rotation.z + Math.sin(t * 0.6) * 0.03 + droop
    head.rotation.y = rest(head).rotation.y + Math.sin(t * 0.37) * 0.07 + shake
    headCrank.rotation.z = rest(headCrank).rotation.z + t * 0.8
    armCrank.rotation.z = rest(armCrank).rotation.z + Math.sin(t * 0.7) * 0.35
    arm.rotation.z = rest(arm).rotation.z + Math.sin(t * 0.8) * 0.06
    const snap = Math.max(0, Math.sin(t * 1.3)) ** 8 * 0.35
    clawLeft.rotation.x = rest(clawLeft).rotation.x + snap
    clawRight.rotation.x = rest(clawRight).rotation.x - snap
  })
  return <primitive object={scene} position={[CENTER_X, 9.06, -16]} rotation={[0, -Math.PI / 2, 0]} />
}

export function FactoryP03({ view, outcome, face }: { view: View; outcome?: 'win' | 'loss'; face?: ScriptedFace }) {
  const felt = useP03Face(view, outcome)
  const shown = face ?? felt
  const mood = shown === 'neutral' ? 'smug' : shown
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
