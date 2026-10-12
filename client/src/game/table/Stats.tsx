import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { faceCount } from './faces.ts'

/** On with ?stats, off with ?stats=0, and remembered for the browser session in between. */
export function statsWanted(): boolean {
  const asked = new URLSearchParams(window.location.search).get('stats')
  try {
    if (asked !== null) sessionStorage.setItem('grimrepo:stats', asked === '0' ? '0' : '1')
    return sessionStorage.getItem('grimrepo:stats') === '1'
  } catch {
    return asked !== null && asked !== '0'
  }
}

type Sample = {
  fps: number
  ms: number
  dpr: number
  calls: number
  triangles: number
  textures: number
  geometries: number
  faces: number
}

// Written by the probe inside the canvas and read by the panel outside it.
let latest: Sample | null = null

const WINDOW_S = 0.5

/** Counts each whole frame, post-processing passes included, by resetting the renderer's counters only once a frame. */
export function StatsProbe() {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
      latest = null
    }
  }, [gl])
  const span = useRef({ time: 0, frames: 0 })
  useFrame((_, delta) => {
    const now = span.current
    now.time += delta
    now.frames++
    if (now.time >= WINDOW_S) {
      latest = {
        fps: now.frames / now.time,
        ms: (now.time / now.frames) * 1000,
        dpr: gl.getPixelRatio(),
        // Last frame's counts: the counters run from one reset to the next.
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
        faces: faceCount(),
      }
      now.time = 0
      now.frames = 0
    }
    gl.info.reset()
  })
  return null
}

/** The numbers, at the top middle where the header and table leave room, refreshed twice a second so drawing them costs nothing noticeable. */
export function StatsPanel({ quality }: { quality: number }) {
  const [shown, setShown] = useState<Sample | null>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setShown(latest && { ...latest }), WINDOW_S * 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!shown) return null
  return (
    <pre
      aria-hidden
      className="pointer-events-none fixed top-1 left-1/2 z-[70] -translate-x-1/2 rounded-sm bg-black/75 px-2 py-1 font-mono text-xs leading-snug text-[#7dff9a]"
    >
      {`${Math.round(shown.fps)} fps  ${shown.ms.toFixed(1)} ms  dpr ${shown.dpr.toFixed(2)}  quality ${quality}\n`}
      {`calls ${shown.calls}  tris ${(shown.triangles / 1000).toFixed(0)}k\n`}
      {`textures ${shown.textures}  geometries ${shown.geometries}  faces ${shown.faces}`}
    </pre>
  )
}
