import * as THREE from 'three'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { TINT } from '../palette.ts'

export const LIT = TINT.glow
export const GLOW = new THREE.Color(...TINT.glowHdr)
export const SCREEN_HDR = new THREE.Color(1.7, 1.7, 1.7)
export const DUST = new THREE.Color(TINT.cool).multiplyScalar(2)
export const STILL = prefersReducedMotion()

const WHITE = new THREE.Color()
export const lamp = (color: string, tint: number) =>
  '#' +
  WHITE.set(color)
    .lerp(new THREE.Color(TINT.glow), tint * 0.6)
    .getHexString()
