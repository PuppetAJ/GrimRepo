import { MAP_COLUMNS, type MapNode, type StageMap } from 'shared'

/** Where a node sits, as fractions of the map: x across, y down from the boss at 0 to the first row at 1. */
export type Spot = { x: number; y: number }

/** The boss's row is this many rows tall, since the boss is drawn half again as large and must clear the row below. */
export const BOSS_ROW = 1.3

/** The map's height in rows, the boss's row counted as BOSS_ROW. */
export const mapRows = (map: StageMap) => map.rows.length - 1 + BOSS_ROW

// How far a node may stray from its cell's center, as fractions of a column and a row.
const STRAY_X = 0.28
const STRAY_Y = 0.22

/** A number in [0, 1) from the seed and a node's id, the same on every device. */
function hash(seed: number, text: string): number {
  let value = seed ^ 0x9e3779b9
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 0x85ebca6b) ^ (value >>> 13)
  return ((value ^ (value >>> 16)) >>> 0) / 2 ** 32
}

/** Each node in its grid cell, nudged off center so the map doesn't look ruled; `room` caps the nudge. */
export function spots(map: StageMap, seed: number, room: Spot = { x: STRAY_X, y: STRAY_Y }): Map<string, Spot> {
  const last = map.rows.length - 1
  const placed = new Map<string, Spot>()
  for (const node of map.rows.flat()) {
    const boss = node.kind === 'boss'
    const nudge = (salt: string, reach: number) =>
      boss ? 0 : (hash(seed + map.stage, node.id + salt) - 0.5) * 2 * reach
    placed.set(node.id, {
      x: (node.col + 0.5 + nudge('x', Math.min(STRAY_X, room.x))) / MAP_COLUMNS,
      y:
        (boss ? BOSS_ROW / 2 : BOSS_ROW + last - 1 - node.row + 0.5 + nudge('y', Math.min(STRAY_Y, room.y))) /
        mapRows(map),
    })
  }
  return placed
}

const SIDES = ['far left', 'left', 'center', 'right', 'far right']

/** Where a node is in words, for telling apart two of a kind in one row. */
export const sideOf = (node: MapNode) => SIDES[node.col] ?? `column ${node.col + 1}`
