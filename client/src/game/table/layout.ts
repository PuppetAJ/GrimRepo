import { LANES } from 'shared'

export type Vec3 = [number, number, number]

// World sizes and places. The board is built on this grid; the 2022 game's lanes were placed by hand.
export const CARD = { width: 0.75, height: 1.26, depth: 0.012 }
export const TABLE_Y = 7.0

/** The factory's card is a floppy disk: a plastic body with raised rims, and these recesses, as fractions of the face from its top-left. */
export const DISK = { depth: 0.024, relief: 0.011, clip: 0.11 }
// Measured from Act 3's card: a full-width label, one tall screen holding the art, a divider and the sigils, and the stats along the foot.
export const RECESS = {
  label: [0.06, 0.055, 0.94, 0.165],
  screen: [0.05, 0.19, 0.95, 0.855],
  attack: [0.05, 0.885, 0.36, 0.975],
  health: [0.64, 0.885, 0.95, 0.975],
} as const satisfies Record<string, readonly [number, number, number, number]>
/** Where the divider crosses the screen, and where the sigils sit under it, as fractions of the face's height. */
export const SCREEN_DIVIDER = 0.635
export const SIGIL_BAND = [0.655, 0.84] as const
const CENTER_X = -1.975
export const LANE_GAP = 0.86
const LANE_X = [...Array(LANES).keys()].map((lane) => CENTER_X + (lane - (LANES - 1) / 2) * LANE_GAP)
export const ROW_Z = { board: -8.72, front: -10.3, back: -11.74 }
export const BOARD_CENTER: Vec3 = [CENTER_X, TABLE_Y, ROW_Z.front]
export const DECK: Vec3 = [0.55, TABLE_Y, -8.85]
export const PILE: Vec3 = [1.55, TABLE_Y, -8.85]
export const BELL: Vec3 = [-4.5, TABLE_Y, -8.85]
/** Where P03's new cards come from: above its side of the table. */
export const P03_HAND: Vec3 = [CENTER_X, TABLE_Y + 1.2, -13]

export type Row = keyof typeof ROW_Z

/** How far the board's frames and marks stand off the table; cards lie just above them. */
export const BOARD_DEPTH = 0.018

/** A card lying face up in a lane, a hair above the board. */
export function slot(row: Row, lane: number, lift = 0): Vec3 {
  return [LANE_X[lane] ?? 0, TABLE_Y + BOARD_DEPTH + 0.004 + CARD.depth / 2 + lift, ROW_Z[row]]
}

export const lanes = [...Array(LANES).keys()]

// The hand is held in front of the camera, in its own space: x right, y up, z towards the viewer.
// At rest a hand card shows down to its stats; hovering lifts it fully into view.
const HAND = { distance: 1.5, scale: 0.4, y: -0.59, spread: 1.4, gap: 0.4, raise: 0.14, hover: 0.09, stowed: -0.5 }
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
  // Solved for, not eyeballed: the player's row clears the hand and P03's screen stays in frame (at 16:9, 60°).
  table: { position: [-1.975, 8.7, -4.4], target: [-1.975, 7.4, -10.6] },
  board: { position: [-1.975, 11.4, -6.9], target: [-1.975, TABLE_Y, -9.05] },
}
