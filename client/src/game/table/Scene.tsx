import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Nudge } from './Board.tsx'
import { BELL, type Vec3 } from './layout.ts'

// No model is compressed yet, so drei's Draco and meshopt decoders stay off; meshopt's WebAssembly breaks the CSP.
const useModel = (url: string) => useGLTF(url, false, false)
type Click = (event: ThreeEvent<MouseEvent>) => void

// Hitboxes modelled in 2022 for the old raycaster; the table has its own now.
const HITBOXES = /hitbox/i

function hideHitboxes(root: THREE.Object3D) {
  root.traverse((object) => {
    if (HITBOXES.test(object.name)) object.visible = false
  })
}

export function Room() {
  const { scene } = useModel('/models/house.glb')
  return <primitive object={scene} scale={20} />
}

/** P03, playing every clip it was animated with; `face`, when given, replaces the one on its screen, and `tint` colours it. */
export function Robot({ face, tint = '#ffffff' }: { face?: THREE.Texture; tint?: string }) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useModel('/models/robot.glb')
  const { actions } = useAnimations(animations, group)
  useLayoutEffect(
    () =>
      scene.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (material?.name !== 'Screen' || !material.emissiveMap) return
        // The model is cached across scenes, so its own face is kept aside the first time.
        const own = (material.userData['own'] ??= screenFace(material.emissiveMap)) as THREE.Texture
        material.emissiveMap = face ?? own
        material.emissive.set(tint)
        // Authored ten times brighter than three.js now honours.
        material.emissiveIntensity = 1.6
      }),
    [scene, face, tint],
  )
  useEffect(() => {
    for (const action of Object.values(actions)) action?.reset().play()
  }, [actions])
  return (
    <group ref={group} position={[-2, 2, -10]} rotation={[0, 3.1, 0]} scale={100}>
      <primitive object={scene} />
    </group>
  )
}

/** P03's face is drawn in the texture's alpha over white, so it is redrawn onto black for the screen to glow. */
function screenFace(face: THREE.Texture): THREE.Texture {
  const image = face.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  const lit = new THREE.CanvasTexture(canvas)
  lit.flipY = face.flipY
  lit.colorSpace = THREE.SRGBColorSpace
  lit.magFilter = THREE.NearestFilter
  return lit
}

export function Bell({ onClick, active, rung }: { onClick: Click; active: boolean; rung: number }) {
  const { scene } = useModel('/models/bell.glb')
  useLayoutEffect(() => hideHitboxes(scene), [scene])
  const bell = useRef<THREE.Group>(null)
  const pressed = useRef(0)
  useEffect(() => {
    if (rung) pressed.current = 1
  }, [rung])
  useFrame((_, delta) => {
    if (!bell.current) return
    pressed.current = Math.max(0, pressed.current - delta * 4)
    bell.current.scale.y = 1 - Math.sin(pressed.current * Math.PI) * 0.18
  })
  return (
    <group position={BELL}>
      <Nudge active={active} onClick={onClick} size={[0.9, 1.2, 0.9]} label="bell" lift={0.02}>
        <group ref={bell}>
          <primitive object={scene} rotation={[-Math.PI, 0, -Math.PI]} scale={0.01} />
        </group>
      </Nudge>
    </group>
  )
}

// The candle from the 2022 game: prisoner849's flame shader, with its credits kept in the README.
const flameVertex = /* glsl */ `
  uniform float time;
  varying vec2 vUv;
  varying float hValue;
  float random(in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
  float noise(in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos *= vec3(0.8, 2, 0.725);
    hValue = position.y;
    float posXZlen = length(position.xz);
    pos.y *= 1. + (cos((posXZlen + 0.25) * 3.1415926) * 0.25 + noise(vec2(0, time)) * 0.125 + noise(vec2(position.x + time, position.z + time)) * 0.5) * position.y;
    pos.x += noise(vec2(time * 2., (position.y - time) * 4.0)) * hValue * 0.0312;
    pos.z += noise(vec2((position.y - time) * 4.0, time * 2.)) * hValue * 0.0312;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`
const flameFragment = /* glsl */ `
  varying float hValue;
  varying vec2 vUv;
  vec3 heatmapGradient(float t) {
    return clamp((pow(t, 1.5) * 0.8 + 0.2) * vec3(smoothstep(0.0, 0.35, t) + t * 0.5, smoothstep(0.5, 1.0, t), max(1.0 - t * 1.7, t * 7.0 - 6.0)), 0.0, 1.0);
  }
  void main() {
    float v = abs(smoothstep(0.0, 0.4, hValue) - 1.);
    float alpha = (1. - v) * 0.99;
    alpha -= 1. - smoothstep(1.0, 0.97, hValue);
    gl_FragColor = vec4(heatmapGradient(smoothstep(0.0, 0.3, hValue)) * vec3(0.95, 0.95, 0.4), alpha);
    gl_FragColor.rgb = mix(vec3(0, 0, 1), gl_FragColor.rgb, smoothstep(0.0, 0.3, hValue));
    gl_FragColor.rgb += vec3(1, 0.9, 0.5) * (1.25 - vUv.y);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.66, 0.32, 0.03), smoothstep(0.95, 1., hValue));
  }
`

const CANDLE: Vec3 = [-5.61, 8.9, -12.6]

export function Candle() {
  const uniforms = useMemo(() => ({ time: { value: 0 } }), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: flameVertex,
        fragmentShader: flameFragment,
        transparent: true,
      }),
    [uniforms],
  )
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 32, 32).translate(0, 0.5, 0), [])
  const flicker = useRef<THREE.PointLight>(null)
  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    uniforms.time.value = time
    if (!flicker.current) return
    flicker.current.position.x = CANDLE[0] + 0.6 + Math.sin(time * Math.PI) * 0.25
    flicker.current.position.z = CANDLE[2] + Math.cos(time * Math.PI * 0.75) * 0.25
    flicker.current.intensity = 26 + Math.sin(time * Math.PI * 0.5) * Math.cos(time * Math.PI * 1.5) * 3
  })
  return (
    <>
      <mesh geometry={geometry} material={material} position={CANDLE} rotation={[0, -Math.PI / 4, 0]} scale={0.1} />
      <pointLight
        color="#ffaa33"
        position={[CANDLE[0] - 0.4, CANDLE[1] + 0.1, CANDLE[2]]}
        intensity={30}
        decay={2}
        distance={6}
      />
      <pointLight
        ref={flicker}
        color="#ffaa33"
        position={[CANDLE[0] + 0.6, CANDLE[1] + 1.1, CANDLE[2]]}
        intensity={26}
        decay={1.4}
        distance={14}
      />
    </>
  )
}

/** Warm fill for the room, and a lamp over the board so the cards can be read. */
export function Lights() {
  return (
    <>
      <ambientLight color="#ffaa33" intensity={0.35} />
      <pointLight color="#ffb35c" position={[-1.975, 9.6, -8.6]} intensity={9} decay={1.6} distance={9} />
    </>
  )
}
