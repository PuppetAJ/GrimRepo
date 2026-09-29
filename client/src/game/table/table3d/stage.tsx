import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Button } from '@/components/ui/button.tsx'
import { cursorCss, onCursor } from '../cursor.ts'
import { BOARD_CENTER, CAMERA, type CameraView } from '../layout.ts'
import { MOOD } from '../mood.ts'

const seat = new THREE.Vector3()

/** Eases the camera between the seat and the view over the board, leaning a little towards the pointer. */
export function CameraRig({ view }: { view: CameraView }) {
  const target = useRef(new THREE.Vector3(...CAMERA[view].target))
  useFrame(({ camera, pointer }, delta) => {
    const [x, y, z] = CAMERA[view].position
    seat.set(x + pointer.x * 0.12, y + pointer.y * 0.06, z)
    easing.damp3(camera.position, seat, 0.18, delta)
    easing.damp3(target.current, CAMERA[view].target, 0.18, delta)
    camera.lookAt(target.current)
  })
  return null
}

/** For the table's first frames, draws everything, off-screen too, and a stand-in popup, so no shader is built mid-turn. */
export function WarmUp({ onWarm }: { onWarm: () => void }) {
  const [warm, setWarm] = useState(false)
  const frames = useRef(0)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    // Made as Popup makes its own, so the shader built is the one it will use.
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false, opacity: 0 })
  }, [])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  // Off-screen things are drawn too for these frames, or their shaders wait until the camera first turns to them.
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

/** Shows the cursor the hovered thing asks for, and looks again on coming back to the tab, where the pointer never left. */
export function CursorSync() {
  const { gl, events } = useThree()
  useEffect(() => {
    const stop = onCursor((kind) => (gl.domElement.style.cursor = cursorCss(kind)))
    const again = () => events.update?.()
    const shown = () => document.visibilityState === 'visible' && again()
    window.addEventListener('focus', again)
    // Zooming resizes the window under a still pointer, so what it is over is looked up again.
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

/** The renderer's exposure, from the mood. */
export function Exposure() {
  const gl = useThree((three) => three.gl)
  useLayoutEffect(() => void (gl.toneMappingExposure = MOOD.exposure), [gl])
  return null
}

export function NoWebGL({ onText }: { onText: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-terminal text-2xl text-p03">This browser cannot draw the 3D table.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}

/** Mounts once everything the table needs has loaded; the room and P03 may still be arriving. */
export function Loaded({ onLoad }: { onLoad: (loaded: boolean) => void }) {
  useEffect(() => onLoad(true), [onLoad])
  return null
}
