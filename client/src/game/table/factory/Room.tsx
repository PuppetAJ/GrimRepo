import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CENTER_X, TABLE_Y } from '../layout.ts'
import { MOOD } from '../mood.ts'
import { TINT } from '../palette.ts'
import { GLOW } from './constants.ts'
import { GRIMY_TABLE, metal, surfaces } from './surfaces.ts'

// Each bar is [x, z, width, depth], around the 10.4 by 7.4 console top centered at z -9.9.
const TRIM: [number, number, number, number][] = [
  [CENTER_X, -6.26, 10.52, 0.12],
  [CENTER_X, -13.54, 10.52, 0.12],
  [CENTER_X - 5.2, -9.9, 0.12, 7.4],
  [CENTER_X + 5.2, -9.9, 0.12, 7.4],
]

export function Room() {
  const clean = metal(useTexture(surfaces('table')), [4, 3])
  const table = metal({ ...clean, map: useTexture(GRIMY_TABLE) }, [4, 3])
  const floor = metal(useTexture(surfaces('floor')), [12, 12])
  const wall = metal(useTexture(surfaces('wall')), [8, 3])
  const rough = { metalness: 0.55, normalScale: new THREE.Vector2(1.6, 1.6) }
  return (
    <>
      <mesh position={[CENTER_X, TABLE_Y / 2, -9.9]}>
        <boxGeometry args={[10.4, TABLE_Y, 7.4]} />
        {[0, 1, 3, 4, 5].map((side) => (
          <meshStandardMaterial key={side} attach={`material-${side}`} {...wall} color="#2a3138" metalness={0.7} />
        ))}
        <meshStandardMaterial attach="material-2" {...table} {...rough} color="#8a98a6" roughness={0.85} />
      </mesh>
      {TRIM.map(([x, z, width, depth], i) => (
        <mesh key={i} position={[x, TABLE_Y + 0.03, z]}>
          <boxGeometry args={[width, 0.1, depth]} />
          {/* Part metal and faintly lit: pure metal with nothing to reflect renders black. */}
          <meshStandardMaterial
            {...clean}
            color="#4a535b"
            metalness={0.6}
            roughness={0.38}
            emissive={TINT.fill}
            emissiveIntensity={MOOD.trimGlow}
          />
        </mesh>
      ))}
      <mesh position={[CENTER_X, TABLE_Y - 0.05, -6.18]}>
        <boxGeometry args={[10.4, 0.03, 0.03]} />
        <meshBasicMaterial color={GLOW} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0, -10]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial {...floor} color="#3c444c" metalness={0.7} />
      </mesh>
      <mesh position={[CENTER_X, 10, -22]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial {...wall} color="#2f363d" metalness={0.7} />
      </mesh>
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[CENTER_X + sign * 13, 10, -10]} rotation={[0, -sign * (Math.PI / 2), 0]}>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial {...wall} color="#2a3037" metalness={0.7} />
        </mesh>
      ))}
      {[9.2, 12.6, 16.1].map((y, i) => (
        <mesh key={y} position={[CENTER_X, y, -21.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22 + i * 0.04, 0.22 + i * 0.04, 38, 12]} />
          <meshStandardMaterial color="#20262c" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
    </>
  )
}
