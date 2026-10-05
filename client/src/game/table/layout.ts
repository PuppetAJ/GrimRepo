import { LANES, TIP } from 'shared'

export type Vec3 = [number, number, number]

export const CARD = { width: 0.75, height: 1.26, depth: 0.012 }
export const TABLE_Y = 7.0

/** depth and relief in world units, clip as a fraction of the width, compact as a closed disk's height scale. */
export const DISK = { depth: 0.024, relief: 0.011, clip: 0.11, compact: 0.68 }
/** They go right through the disk, so face drawings must leave them clear. */
export const CORNER_HOLES = [
  [0.09, 0.02, 0.15, 0.06],
  [0.85, 0.02, 0.91, 0.06],
] as const
/** Only the middle section compresses when the disk closes. */
export const SECTIONS = { middleTop: 0.215, middleBottom: 0.855 } as const
// [x0, y0, x1, y1] as fractions of the face from its top-left corner.
export const RECESS = {
  label: [0.06, 0.105, 0.94, 0.2],
  screen: [0.05, 0.215, 0.95, 0.855],
  attack: [0.05, 0.885, 0.36, 0.975],
  health: [0.64, 0.885, 0.95, 0.975],
} as const satisfies Record<string, readonly [number, number, number, number]>
// Fractions of the face's height.
export const SCREEN_DIVIDER = 0.65
export const SIGIL_BAND = [0.67, 0.84] as const
export const CENTER_X = -1.975
export const LANE_GAP = 0.86
const LANE_X = [...Array(LANES).keys()].map((lane) => CENTER_X + (lane - (LANES - 1) / 2) * LANE_GAP)
export const ROW_Z = { board: -8.72, front: -10.3, back: -11.74 }
export const BOARD_CENTER: Vec3 = [CENTER_X, TABLE_Y, ROW_Z.front]
export const DECK: Vec3 = [0.65, TABLE_Y, -8.25]
export const PILE: Vec3 = [1.6, TABLE_Y, -8.25]
export const BELL: Vec3 = [-4.9, TABLE_Y, -8.85]
/** Where P03's new cards spawn. */
export const P03_HAND: Vec3 = [CENTER_X, TABLE_Y + 1.2, -13]

export type Row = keyof typeof ROW_Z

/** Height of the board's frames above the table; cards lie just above it. */
export const BOARD_DEPTH = 0.018

export function slot(row: Row, lane: number, lift = 0): Vec3 {
  return [LANE_X[lane] ?? 0, TABLE_Y + BOARD_DEPTH + 0.004 + CARD.depth / 2 + lift, ROW_Z[row]]
}

export const lanes = [...Array(LANES).keys()]

// Camera space: x right, y up, z toward the viewer.
const HAND = { distance: 1.5, scale: 0.4, y: -0.455, radius: 3, raise: 0.14, hover: 0.09, stowed: -0.5 }
export const HAND_SCALE = HAND.scale

export function handPlace(
  index: number,
  count: number,
  { selected = false, hovered = false, summoning = false } = {},
): { position: Vec3; roll: number; scale: number } {
  // Past five cards the hand shrinks so it stays clear of the board and the screen's edge.
  const scale = HAND.scale * (count > 5 ? 1 - (count - 5) * 0.05 : 1)
  // Neighbors' bottom corners just meet on the arc, so no card covers another's numbers.
  const step = (CARD.width * scale * 1.04) / (HAND.radius - (CARD.height * scale) / 2)
  const angle = (summoning && selected ? 0 : index - (count - 1) / 2) * step
  // Mid-summon the chosen card rises only a little, to stay clear of the lanes.
  const raise = summoning ? (selected ? 0.04 : HAND.stowed) : selected ? HAND.raise : hovered ? HAND.hover : 0
  const reach = HAND.radius + raise
  const near = angle * 0.08 + (hovered || selected ? 0.04 : 0)
  return {
    position: [Math.sin(angle) * reach, HAND.y - HAND.radius + Math.cos(angle) * reach, -HAND.distance + near],
    roll: -angle,
    scale,
  }
}

export type CameraView = 'table' | 'board'

export const CAMERA: Record<CameraView, { position: Vec3; target: Vec3 }> = {
  // Solved so the player's row clears the hand and P03's screen stays in frame at 16:9 and a 60° fov.
  table: { position: [CENTER_X, 8.7, -4.4], target: [CENTER_X, 7.4, -10.6] },
  board: { position: [CENTER_X, 11.4, -6.9], target: [CENTER_X, TABLE_Y, -9.05] },
}

export const BATTERY_CELLS = 6

/** Fractional cells filled, full when the scale tips; positive for the player's lead. */
export const leadCells = (scale: number): number =>
  Math.sign(scale) * Math.min(BATTERY_CELLS, (Math.abs(scale) / TIP) * BATTERY_CELLS) || 0
