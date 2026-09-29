// The factory's place and light, shared by everything built in it.
import * as THREE from 'three'
import { TINT } from '../palette.ts'

export const X = -1.975
// The light the factory is lit by, from the palette.
export const LIT = TINT.glow
export const GLOW = new THREE.Color(...TINT.glowHdr)
// Glow is kept for what is brighter than white, so no lamp can make a lit card glow; these are pushed past it.
export const SCREEN_HDR = new THREE.Color(1.7, 1.7, 1.7)
export const DUST = new THREE.Color(TINT.cool).multiplyScalar(2)
export const STILL = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const WHITE = new THREE.Color()
/** One of the white lamps' colours, leaned toward the palette's own by the mood's tint. */
export const lamp = (colour: string, tint: number) =>
  '#' +
  WHITE.set(colour)
    .lerp(new THREE.Color(TINT.glow), tint * 0.6)
    .getHexString()
