import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Target } from '../reading.ts'

/** Follows a held finger or mouse from card to card; a `sticky` one, from a right-click, stays put until the next press. */
export function HeldReader({
  on,
  sticky,
  onMove,
  onEnd,
}: {
  on: boolean
  sticky: boolean
  onMove: (target: Target | null, x: number, y: number) => void
  onEnd: () => void
}) {
  const { camera, scene, raycaster, gl } = useThree()
  const latest = useRef({ onMove, onEnd })
  useEffect(() => {
    latest.current = { onMove, onEnd }
  })
  useEffect(() => {
    if (!on || !sticky) return
    const end = () => latest.current.onEnd()
    const key = (event: KeyboardEvent) => event.key === 'Escape' && end()
    window.addEventListener('pointerdown', end, true)
    window.addEventListener('keydown', key)
    window.addEventListener('wheel', end, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', end, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('wheel', end)
    }
  }, [on, sticky])
  useEffect(() => {
    if (!on || sticky) return
    const pointer = new THREE.Vector2()
    const at = (x: number, y: number) => {
      const box = gl.domElement.getBoundingClientRect()
      pointer.set(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      // Relies on cards and screens being groups named card-<uid> and screen-<name>.
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
      // Keeps the page still under a held finger.
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
  }, [on, sticky, camera, scene, raycaster, gl])
  return null
}
