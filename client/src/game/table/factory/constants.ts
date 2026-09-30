import * as THREE from 'three'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { TINT } from '../palette.ts'

export const X = -1.975
export const LIT = TINT.glow
export const GLOW = new THREE.Color(...TINT.glowHdr)
// Pushed past 1 so screens clear the bloom threshold that lamps can't.
export const SCREEN_HDR = new THREE.Color(1.7, 1.7, 1.7)
export const DUST = new THREE.Color(TINT.cool).multiplyScalar(2)
export const STILL = prefersReducedMotion()

const WHITE = new THREE.Color()
/** Leans a lamp color toward P03's green by `tint`. */
export const lamp = (color: string, tint: number) =>
  '#' +
  WHITE.set(color)
    .lerp(new THREE.Color(TINT.glow), tint * 0.6)
    .getHexString()
