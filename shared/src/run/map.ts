import { ENCOUNTERS } from '../encounters.ts'
import type { Rng } from '../rng.ts'
import { SCENES } from './scenes.ts'
import type { MapNode, NodeKind, StageMap } from './types.ts'

/** Columns in a stage's grid; a node's `col` is its column in it. */
export const MAP_COLUMNS = 5
// Rows before the boss, and the paths walked up through them.
const ROWS = 7
const PATHS = 4
const UTILITIES: NodeKind[] = ['campfire', 'stones', 'event']
// The middle rows draw from this, battles most often.
const MIXED: NodeKind[] = ['battle', 'battle', 'battle', 'battle', 'card', 'card', 'campfire', 'event', 'stones']
// Every route meets this many battles before the boss, so routes differ but a run's length barely does.
const FEWEST_BATTLES = 2
const MOST_BATTLES = 4
// A map has at least this many nodes below the boss, and reaches both sides in at least this many rows, so it never
// crowds into one corner.
const FEWEST_NODES = 17
const ROWS_EACH_SIDE = 3
const BLIND_SHARE = 1 / 3

type Cell = { row: number; col: number }
const key = ({ row, col }: Cell) => `${row}-${col}`

/** Walks paths up the grid, each step left, right or straight on, never crossing a link already made. */
function walk(rng: Rng): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>()
  const linked = (from: Cell, to: Cell) => links.get(key(from))?.has(key(to)) ?? false
  let first = -1
  for (let path = 0; path < PATHS; path++) {
    let col = rng.int(0, MAP_COLUMNS - 1)
    // The first two paths start apart, so the first choice is a real one.
    while (path === 1 && col === first) col = rng.int(0, MAP_COLUMNS - 1)
    if (path === 0) first = col
    if (!links.has(key({ row: 0, col }))) links.set(key({ row: 0, col }), new Set())
    for (let row = 0; row < ROWS - 1; row++) {
      const options = [col - 1, col, col + 1].filter(
        (to) =>
          to >= 0 &&
          to < MAP_COLUMNS &&
          // A diagonal crosses the opposite diagonal between the same two columns.
          !(to !== col && linked({ row, col: to }, { row: row + 1, col })),
      )
      const to = rng.pick(options)
      const from = key({ row, col })
      links.get(from)?.add(key({ row: row + 1, col: to }))
      if (!links.has(key({ row: row + 1, col: to }))) links.set(key({ row: row + 1, col: to }), new Set())
      col = to
    }
  }
  return links
}

/** Whether the walked grid is full enough and reaches both sides. */
function spread(links: Map<string, Set<string>>): boolean {
  const cells = [...links.keys()].map((id) => id.split('-').map(Number) as [number, number])
  const rows = (side: (col: number) => boolean) =>
    new Set(cells.filter(([, col]) => side(col)).map(([row]) => row)).size
  return (
    cells.length >= FEWEST_NODES &&
    rows((col) => col < Math.floor(MAP_COLUMNS / 2)) >= ROWS_EACH_SIDE &&
    rows((col) => col > Math.floor(MAP_COLUMNS / 2)) >= ROWS_EACH_SIDE
  )
}

/** The fewest and most battles on any route from each node to the boss. */
function battles(rows: MapNode[][]): { fewest: number; most: number } {
  const range = new Map<string, [number, number]>()
  for (let row = rows.length - 1; row >= 0; row--)
    for (const node of rows[row] as MapNode[]) {
      const own = node.kind === 'battle' ? 1 : 0
      const ahead = node.next.map((id) => range.get(id)).filter((found): found is [number, number] => Boolean(found))
      range.set(node.id, [
        own + (ahead.length ? Math.min(...ahead.map(([low]) => low)) : 0),
        own + (ahead.length ? Math.max(...ahead.map(([, high]) => high)) : 0),
      ])
    }
  const starts = (rows[0] ?? []).map((node) => range.get(node.id) as [number, number])
  return { fewest: Math.min(...starts.map(([low]) => low)), most: Math.max(...starts.map(([, high]) => high)) }
}

/** Kinds by row: cards first, utilities last, a mix between; false if a utility had to follow itself. */
function assign(rows: MapNode[][], rng: Rng, fallback: boolean): boolean {
  const parents = new Map<string, NodeKind[]>()
  let clean = true
  for (const [index, row] of rows.entries()) {
    for (const node of row) {
      const above = parents.get(node.id) ?? []
      const fresh = (kinds: NodeKind[]) => kinds.filter((kind) => !(UTILITIES.includes(kind) && above.includes(kind)))
      if (index === 0) node.kind = 'card'
      else if (index === ROWS - 1) {
        clean &&= fresh(UTILITIES).length > 0
        node.kind = rng.pick(fresh(UTILITIES).length ? fresh(UTILITIES) : UTILITIES)
      }
      // Should the mix keep failing, battles in two rows and cards between always meet the rules.
      else if (fallback) node.kind = index === 2 || index === 4 ? 'battle' : 'card'
      else node.kind = rng.pick(fresh(MIXED))
      for (const id of node.next) parents.set(id, [...(parents.get(id) ?? []), node.kind])
    }
  }
  return clean
}

export function generateStage(stage: number, rng: Rng): StageMap {
  const fights = Object.values(ENCOUNTERS).filter((found) => found.stage === stage && !found.boss)
  const boss = Object.values(ENCOUNTERS).find((found) => found.stage === stage && found.boss)
  if (!fights.length || !boss) throw new Error(`Stage ${stage} has no encounters`)
  const scenes = Object.keys(SCENES)

  // Walked again until it spreads out, keeping the last walk should it never.
  let links = walk(rng)
  for (let attempt = 0; attempt < 30 && !spread(links); attempt++) links = walk(rng)
  const top = { row: ROWS, col: Math.floor(MAP_COLUMNS / 2) }
  const rows: MapNode[][] = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: MAP_COLUMNS }, (_, col) => ({ row, col }))
      .filter((cell) => links.has(key(cell)))
      .map((cell) => ({
        id: key(cell),
        kind: 'card' as NodeKind,
        ...cell,
        next: row === ROWS - 1 ? [key(top)] : [...(links.get(key(cell)) ?? [])].sort(),
      })),
  )
  rows.push([{ id: key(top), kind: 'boss', ...top, next: [], encounter: boss.id }])

  for (let attempt = 0; ; attempt++) {
    const fallback = attempt >= 40
    const clean = assign(rows.slice(0, ROWS), rng, fallback)
    const { fewest, most } = battles(rows)
    if (fallback || (clean && fewest >= FEWEST_BATTLES && most <= MOST_BATTLES)) break
  }
  // One shop a stage, a little past the middle, in place of a node that isn't a battle.
  const spots = rows
    .slice(3, ROWS - 1)
    .flat()
    .filter((node) => node.kind !== 'battle')
  if (spots.length) rng.pick(spots).kind = 'shop'
  for (const node of rows.flat()) {
    // A third of the card choices past the first row show only traits.
    if (node.kind === 'card' && node.row > 0 && rng.float() < BLIND_SHARE) node.blind = true
    if (node.kind === 'battle') node.encounter = rng.pick(fights).id
    if (node.kind === 'campfire') node.boost = rng.pick(['attack', 'health'] as const)
    if (node.kind === 'event') node.event = rng.pick(scenes)
  }
  return { stage, rows }
}

export const findNode = (map: StageMap, id: string): MapNode | undefined =>
  map.rows.flat().find((node) => node.id === id)
