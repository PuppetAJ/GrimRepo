import { LANES } from 'shared'

export type Vec3 = [number, number, number]

// World sizes and places, measured from the 2022 board, deck and bell models as the old game placed them.
export const CARD = { width: 0.75, height: 1.26, depth: 0.012 }
export const TABLE_Y = 7.0
const LANE_X = [-3.18, -2.38, -1.58, -0.77]
const ROW_Z = { board: -8.76, front: -10.22, back: -11.53 }
export const BOARD_CENTER: Vec3 = [-1.975, TABLE_Y, -10.1]
export const DECK: Vec3 = [0.5, TABLE_Y, -8.8]
export const PILE: Vec3 = [1.5, TABLE_Y, -8.8]
export const BELL: Vec3 = [-4.4, TABLE_Y, -8.8]
/** Where P03's new cards come from: above its side of the table. */
export const P03_HAND: Vec3 = [-1.975, TABLE_Y + 1.2, -13]

export type Row = keyof typeof ROW_Z

/** A card lying face up in a lane, a hair above the board. */
export function slot(row: Row, lane: number, lift = 0): Vec3 {
  return [LANE_X[lane] ?? 0, TABLE_Y + CARD.depth + lift, ROW_Z[row]]
}

export const lanes = [...Array(LANES).keys()]

// The hand is held in front of the camera, in its own space: x right, y up, z towards the viewer.
const HAND = { distance: 1.5, scale: 0.5, y: -0.86, spread: 1.4, gap: 0.42, raise: 0.2, hover: 0.07, stowed: -0.32 }
export const HAND_SCALE = HAND.scale

/** A hand card's place and tilt, fanned about the middle of the hand. */
export function handPlace(
  index: number,
  count: number,
  { selected = false, hovered = false, summoning = false } = {},
): { position: Vec3; roll: number } {
  const gap = count > 1 ? Math.min(HAND.gap, HAND.spread / (count - 1)) : 0
  // The card being summoned moves to the middle, under the board.
  const offset = summoning && selected ? 0 : index - (count - 1) / 2
  // While a card is being summoned the rest of the hand drops away, and it rises only a little, clear of the lanes.
  const raise = summoning ? (selected ? 0.04 : HAND.stowed) : selected ? HAND.raise : hovered ? HAND.hover : 0
  const lift = raise - Math.abs(offset) * 0.025
  // Later cards sit a little nearer, so neighbours overlap the way a held hand does; a card being looked at comes forward.
  const near = index * 0.002 + (hovered || selected ? 0.03 : 0)
  return { position: [offset * gap, HAND.y + lift, -HAND.distance + near], roll: -offset * 0.04 }
}

export type CameraView = 'table' | 'board'

/** The two places the player can look from: their seat, and straight down over the board. */
export const CAMERA: Record<CameraView, { position: Vec3; target: Vec3 }> = {
  table: { position: [-1.975, 9.5, -5.2], target: [-1.975, 7.75, -10.6] },
  board: { position: [-1.975, 12.1, -7.75], target: [-1.975, TABLE_Y, -10.35] },
}
