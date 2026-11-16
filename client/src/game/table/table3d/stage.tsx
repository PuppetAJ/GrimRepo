import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { cursorCss, onCursor } from '../cursor.ts'
import { STILL } from '../factory/constants.ts'
import { BOARD_CENTER, CAMERA, FOV, type CameraView } from '../layout.ts'
import { MOOD } from '../mood.ts'

export const fitFov = (fov: number, halfWidthTan: number | undefined, aspect: number) =>
  halfWidthTan ? Math.max(fov, THREE.MathUtils.radToDeg(2 * Math.atan(halfWidthTan / aspect))) : fov

const seat = new THREE.Vector3()
const aim = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

type Glide = { position: THREE.Vector3; target: THREE.Vector3; fov: number; at: number; length: number }

export function CameraRig({
  view,
  from,
  glide = 0.55,
  arrive = 1.15,
  halfWidthTan,
}: {
  view: CameraView
  from?: CameraView
  glide?: number
  arrive?: number
  halfWidthTan?: number
}) {
  const target = useRef(new THREE.Vector3(...CAMERA[from ?? view].target))
  const gliding = useRef<Glide | null>(null)
  const shown = useRef<CameraView | null>(null)
  useFrame(({ camera, pointer, clock }, delta) => {
    const lens = camera as THREE.PerspectiveCamera
    const goal = CAMERA[view]
    const fov = fitFov(goal.fov ?? FOV, halfWidthTan, lens.aspect)
    if (shown.current === null && !from) {
      camera.position.set(...goal.position)
      target.current.set(...goal.target)
      lens.fov = fov
    }
    if (shown.current !== view) {
      const length = shown.current === null ? (from ? arrive : 0) : glide
      gliding.current = {
        position: camera.position.clone(),
        target: target.current.clone(),
        fov: lens.fov,
        at: clock.elapsedTime,
        length,
      }
      shown.current = view
    }
    const [x, y, z] = goal.position
    const sway = view === 'board' || view === 'queue' ? 0.25 : 1
    const now = gliding.current
    const t = now && now.length > 0 ? Math.min(1, (clock.elapsedTime - now.at) / now.length) : 1
    if (STILL) {
      camera.position.set(x, y, z)
      target.current.set(...goal.target)
      lens.fov = fov
    } else if (now && t < 1) {
      const k = easeInOut(t)
      seat.set(x + pointer.x * 0.12 * sway, y + pointer.y * 0.06 * sway, z)
      camera.position.lerpVectors(now.position, seat, k)
      target.current.lerpVectors(now.target, aim.set(...goal.target), k)
      lens.fov = THREE.MathUtils.lerp(now.fov, fov, k)
    } else {
      gliding.current = null
      seat.set(x + pointer.x * 0.12 * sway, y + pointer.y * 0.06 * sway, z)
      easing.damp3(camera.position, seat, 0.18, delta)
      easing.damp3(target.current, goal.target, 0.18, delta)
      lens.fov = fov
    }
    if (lens.fov !== lens.userData['fov']) {
      lens.userData['fov'] = lens.fov
      lens.updateProjectionMatrix()
    }
    camera.lookAt(target.current)
  })
  return null
}

export function WarmUp({ onWarm }: { onWarm: () => void }) {
  const [warm, setWarm] = useState(false)
  const frames = useRef(0)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false, opacity: 0 })
  }, [])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  // Off-screen objects too, or their shaders wait until the camera first turns to them.
  const { scene } = useThree()
  const culled = useRef<THREE.Object3D[]>([])
  useFrame(() => {
    if (warm) return
    if (frames.current === 0)
      scene.traverse((object) => {
        if (!object.frustumCulled) return
        object.frustumCulled = false
        culled.current.push(object)
      })
    if (++frames.current > 3) {
      for (const object of culled.current) object.frustumCulled = true
      culled.current = []
      setWarm(true)
      onWarm()
    }
  })
  return warm ? null : <sprite material={material} position={BOARD_CENTER} scale={0.01} />
}

export function CursorSync() {
  const { gl, events } = useThree()
  useEffect(() => {
    const stop = onCursor((kind) => (gl.domElement.style.cursor = cursorCss(kind)))
    const again = () => events.update?.()
    const shown = () => document.visibilityState === 'visible' && again()
    window.addEventListener('focus', again)
    // Zooming resizes the window under a still pointer, so recheck what it's over.
    window.addEventListener('resize', again)
    document.addEventListener('visibilitychange', shown)
    return () => {
      stop()
      window.removeEventListener('focus', again)
      window.removeEventListener('resize', again)
      document.removeEventListener('visibilitychange', shown)
    }
  }, [gl, events])
  return null
}

export function Exposure() {
  const gl = useThree((three) => three.gl)
  useLayoutEffect(() => void (gl.toneMappingExposure = MOOD.exposure), [gl])
  return null
}

export function Loaded({ onLoad }: { onLoad: (loaded: boolean) => void }) {
  useEffect(() => onLoad(true), [onLoad])
  return null
}
