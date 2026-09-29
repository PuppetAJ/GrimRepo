import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Target } from '../reading.ts'

/**
 * While a held finger or mouse button keeps the magnifier up, reads whatever card or screen is under it as it moves; a
 * finger's page stays still.
 */
export function HeldReader({
  on,
  onMove,
  onEnd,
}: {
  on: boolean
  onMove: (target: Target | null, x: number, y: number) => void
  onEnd: () => void
}) {
  const { camera, scene, raycaster, gl } = useThree()
  const latest = useRef({ onMove, onEnd })
  useEffect(() => {
    latest.current = { onMove, onEnd }
  })
  useEffect(() => {
    if (!on) return
    const pointer = new THREE.Vector2()
    const at = (x: number, y: number) => {
      const box = gl.domElement.getBoundingClientRect()
      pointer.set(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      // The nearest card or screen under it: each is a group named for what it is.
      let target: Target | null = null
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object
        while (object && !/^(card|screen)-/.test(object.name)) object = object.parent
        if (!object) continue
        target = object.name.startsWith('card-')
          ? { card: Number(object.name.slice(5)) }
          : { screen: object.name === 'screen-log' ? 'log' : 'status' }
        break
      }
      latest.current.onMove(target, x, y)
    }
    const touchMove = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      if (touch) at(touch.clientX, touch.clientY)
    }
    const mouseMove = (event: PointerEvent) => event.pointerType === 'mouse' && at(event.clientX, event.clientY)
    const mouseUp = (event: PointerEvent) => event.pointerType === 'mouse' && latest.current.onEnd()
    const end = () => latest.current.onEnd()
    document.addEventListener('touchmove', touchMove, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    window.addEventListener('pointermove', mouseMove)
    window.addEventListener('pointerup', mouseUp)
    return () => {
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      window.removeEventListener('pointermove', mouseMove)
      window.removeEventListener('pointerup', mouseUp)
    }
  }, [on, camera, scene, raycaster, gl])
  return null
}
