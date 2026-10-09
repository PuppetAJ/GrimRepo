import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../../lib/motion.ts'

const VERTEX = `attribute vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`

// Dot-matrix glyphs lit in slow noise patches, with the odd row slipping sideways.
// High precision where there is any: phones honor mediump, and at their pixel counts the hashes break into blocks.
const FRAGMENT = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float time;
uniform float bright;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 size = vec2(12.0, 18.0);
  float row = floor(px.y / size.y);
  float slip = step(0.985, hash(vec2(row, floor(time * 1.5))));
  px.x += slip * size.x * (hash(vec2(row, floor(time * 1.5) + 3.0)) - 0.5) * 8.0;
  vec2 cell = floor(px / size);
  vec2 dot = floor(fract(px / size) * vec2(6.0, 9.0));
  float inside = step(1.0, dot.x) * step(dot.x, 4.0) * step(2.0, dot.y) * step(dot.y, 7.0);
  float tick = floor(time * (0.2 + hash(cell) * 0.5) + hash(cell + 7.0) * 10.0);
  float bit = step(0.5, hash(cell * 1.7 + dot * 0.31 + tick));
  float field = noise(cell * vec2(0.09, 0.14) + vec2(time * 0.04, -time * 0.03));
  float scan = mod(gl_FragCoord.y, 3.0) < 1.0 ? 0.6 : 1.0;
  float lit = inside * bit * smoothstep(0.5, 0.85, field) * scan * bright;
  gl_FragColor = vec4(vec3(0.49, 1.0, 0.6) * lit, lit);
}`

const FRAME_MS = 1000 / 20

/** Dim glyph noise behind P03's text; static under reduced motion, absent without WebGL. */
export default function FaultyScreen({ bright = 0.2, className = '' }: { bright?: number; className?: string }) {
  const holderRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // A fresh canvas each time, since a context lost on cleanup can't be restored on the same one.
    const element = document.createElement('canvas')
    element.className = 'block size-full [image-rendering:pixelated]'
    const gl = element.getContext('webgl', { antialias: false, powerPreference: 'low-power' })
    const holder = holderRef.current
    if (!holder || !gl) return
    const shader = (type: number, source: string) => {
      const made = gl.createShader(type) as WebGLShader
      gl.shaderSource(made, source)
      gl.compileShader(made)
      return made
    }
    const program = gl.createProgram() as WebGLProgram
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    holder.append(element)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const corner = gl.getAttribLocation(program, 'corner')
    gl.enableVertexAttribArray(corner)
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
    const time = gl.getUniformLocation(program, 'time')
    gl.uniform1f(gl.getUniformLocation(program, 'bright'), bright)

    // One canvas pixel per CSS pixel; the dots are two pixels wide, so nothing finer is needed.
    const fit = () => {
      element.width = Math.max(1, element.clientWidth)
      element.height = Math.max(1, element.clientHeight)
      gl.viewport(0, 0, element.width, element.height)
    }
    const draw = (seconds: number) => {
      gl.uniform1f(time, seconds)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const still = prefersReducedMotion()
    const start = performance.now() - 12_000
    const resized = new ResizeObserver(() => {
      fit()
      draw(still ? 12 : (performance.now() - start) / 1000)
    })
    let frame = 0
    let last = 0
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (document.hidden || now - last < FRAME_MS) return
      last = now
      draw((now - start) / 1000)
    }
    fit()
    resized.observe(element)
    if (still) draw(12)
    else frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      element.remove()
    }
  }, [bright])

  return <span ref={holderRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />
}
