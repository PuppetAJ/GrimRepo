import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { cursorCss, onCursor } from '../cursor.ts'
import { STILL } from '../factory/constants.ts'
import { BOARD_CENTER, CAMERA, type CameraView } from '../layout.ts'
import { MOOD } from '../mood.ts'

const seat = new THREE.Vector3()

export function CameraRig({ view }: { view: CameraView }) {
  const target = useRef(new THREE.Vector3(...CAMERA[view].target))
  useFrame(({ camera, pointer }, delta) => {
    const [x, y, z] = CAMERA[view].position
    // With reduced motion the camera jumps between views and doesn't follow the pointer.
    if (STILL) {
      camera.position.set(x, y, z)
      target.current.set(...CAMERA[view].target)
    } else {
      seat.set(x + pointer.x * 0.12, y + pointer.y * 0.06, z)
      easing.damp3(camera.position, seat, 0.18, delta)
      easing.damp3(target.current, CAMERA[view].target, 0.18, delta)
    }
    camera.lookAt(target.current)
  })
  return null
}

/** Draws everything for the first frames, off-screen too, so no shader compiles mid-turn. */
export function WarmUp({ onWarm }: { onWarm: () => void }) {
  const [warm, setWarm] = useState(false)
  const frames = useRef(0)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    // Matches Popup's material so the shader built here is the one it uses.
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

/** Rechecks what's hovered on returning to the tab, since the pointer never moved. */
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

/** Mounts once the table's suspended assets load; the room and P03 may still be arriving. */
export function Loaded({ onLoad }: { onLoad: (loaded: boolean) => void }) {
  useEffect(() => onLoad(true), [onLoad])
  return null
}
