import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Action, GameState } from 'shared'
import * as THREE from 'three'
import type { Ready } from '../../useGame.ts'
import type { View } from '../../view.ts'
import { BELL, CARD, DECK, PILE, slot } from '../layout.ts'

declare global {
  interface Window {
    /** Development only: the table's state and a way to find things on screen, for the browser suite. */
    __game?: {
      state: () => GameState
      view: () => View
      busy: () => boolean
      act: (action: Action) => void
      skip: () => void
      screen: (
        what: 'deck' | 'pile' | 'bell' | 'log' | 'status' | { lane: number; far?: boolean } | { uid: number },
      ) => { x: number; y: number } | null
      stats: () => Promise<Record<string, number>>
    }
  }
}

export function TestHandle({ game, view, busy, skip }: { game: Ready; view: View; busy: boolean; skip: () => void }) {
  const { camera, gl, scene } = useThree()
  const latest = useRef({ game, view, busy, skip })
  useEffect(() => {
    latest.current = { game, view, busy, skip }
  })
  useEffect(() => {
    const onScreen = (point: THREE.Vector3) => {
      const rect = gl.domElement.getBoundingClientRect()
      const projected = point.clone().project(camera)
      return {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projected.y) / 2) * rect.height,
      }
    }
    window.__game = {
      state: () => latest.current.game.state,
      view: () => latest.current.view,
      busy: () => latest.current.busy,
      act: (action) => latest.current.game.act(action),
      skip: () => latest.current.skip(),
      screen: (what) => {
        if (what === 'deck') return onScreen(new THREE.Vector3(DECK[0], DECK[1] + 0.2, DECK[2]))
        if (what === 'pile') return onScreen(new THREE.Vector3(PILE[0], PILE[1] + 0.1, PILE[2]))
        if (what === 'bell') return onScreen(new THREE.Vector3(BELL[0], BELL[1] + 0.3, BELL[2]))
        if (what === 'log' || what === 'status') {
          const screen = scene.getObjectByName(`screen-${what}`)
          return screen ? onScreen(screen.getWorldPosition(new THREE.Vector3())) : null
        }
        if ('lane' in what) {
          const at = new THREE.Vector3(...slot('board', what.lane))
          // The far edge, toward P03, is the part of a lane's card the hand never covers.
          if (what.far) at.z -= CARD.height * 0.35
          return onScreen(at)
        }
        // Near the top edge, the part of a hand card that is always on screen.
        const object = scene.getObjectByName(`card-${what.uid}`)
        return object ? onScreen(object.localToWorld(new THREE.Vector3(0, CARD.height * 0.36, 0))) : null
      },
      // What one frame costs: counted over a single render, with post-processing's passes included.
      stats: () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            gl.info.autoReset = false
            gl.info.reset()
            requestAnimationFrame(() => {
              const lights = { point: 0, spot: 0, other: 0 }
              let meshes = 0
              scene.traverseVisible((object) => {
                if ((object as THREE.Mesh).isMesh) meshes++
                if ((object as THREE.PointLight).isPointLight) lights.point++
                else if ((object as THREE.SpotLight).isSpotLight) lights.spot++
                else if ((object as THREE.Light).isLight) lights.other++
              })
              resolve({
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                meshes,
                pointLights: lights.point,
                spotLights: lights.spot,
                otherLights: lights.other,
                textures: gl.info.memory.textures,
                geometries: gl.info.memory.geometries,
                programs: gl.info.programs?.length ?? 0,
                pixelRatio: gl.getPixelRatio(),
              })
              gl.info.autoReset = true
            })
          })
        }),
    }
    return () => void delete window.__game
  }, [camera, gl, scene])
  return null
}
