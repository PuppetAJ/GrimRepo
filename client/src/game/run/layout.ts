import { MAP_COLUMNS, type MapNode, type StageMap } from 'shared'

export type Spot = { x: number; y: number }

export const BOSS_ROW = 1.3

export const mapRows = (map: StageMap) => map.rows.length - 1 + BOSS_ROW

const STRAY_X = 0.28
const STRAY_Y = 0.22

function hash(seed: number, text: string): number {
  let value = seed ^ 0x9e3779b9
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 0x85ebca6b) ^ (value >>> 13)
  return ((value ^ (value >>> 16)) >>> 0) / 2 ** 32
}

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

export const sideOf = (node: MapNode) => SIDES[node.col] ?? `column ${node.col + 1}`
