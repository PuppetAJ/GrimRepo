import { ENCOUNTERS } from '../encounters.ts'
import type { Rng } from '../rng.ts'
import { SCENES } from './scenes.ts'
import type { MapNode, NodeKind, StageMap } from './types.ts'

type RowKind = 'card' | 'utility' | 'battle' | 'rest' | 'boss'

// Two triplets of card, utility and battle, then a rest row of two utilities before the boss.
const ROWS: RowKind[] = ['card', 'utility', 'battle', 'card', 'utility', 'battle', 'rest', 'boss']
const UTILITIES: NodeKind[] = ['campfire', 'stones', 'event']

function kinds(row: RowKind, rng: Rng): NodeKind[] {
  if (row === 'boss') return ['boss']
  if (row === 'rest') return rng.shuffle(UTILITIES).slice(0, 2)
  const width = rng.int(1, 3)
  return Array.from({ length: width }, () => (row === 'utility' ? rng.pick(UTILITIES) : row))
}

/** Joins two rows left to right, so every node has a way in and out and no paths cross. */
function join(from: MapNode[], to: MapNode[]): void {
  const at = (index: number, row: MapNode[]) => (index + 0.5) / row.length
  let i = 0
  let j = 0
  ;(from[0] as MapNode).next.push((to[0] as MapNode).id)
  while (i < from.length - 1 || j < to.length - 1) {
    if (i === from.length - 1) j++
    else if (j === to.length - 1) i++
    else {
      const a = at(i + 1, from)
      const b = at(j + 1, to)
      if (a <= b) i++
      if (b <= a) j++
    }
    const node = from[i] as MapNode
    const target = (to[j] as MapNode).id
    if (!node.next.includes(target)) node.next.push(target)
  }
}

export function generateStage(stage: number, rng: Rng): StageMap {
  const battles = Object.values(ENCOUNTERS).filter((found) => found.stage === stage && !found.boss)
  const boss = Object.values(ENCOUNTERS).find((found) => found.stage === stage && found.boss)
  if (!battles.length || !boss) throw new Error(`Stage ${stage} has no encounters`)
  const scenes = Object.keys(SCENES)

  const rows = ROWS.map((row, index) =>
    kinds(row, rng).map((kind, col): MapNode => {
      const node: MapNode = { id: `${index}-${col}`, kind, row: index, col, next: [] }
      if (kind === 'battle') node.encounter = rng.pick(battles).id
      if (kind === 'boss') node.encounter = boss.id
      if (kind === 'campfire') node.boost = rng.pick(['attack', 'health'] as const)
      if (kind === 'event') node.event = rng.pick(scenes)
      return node
    }),
  )
  for (let index = 0; index < rows.length - 1; index++) join(rows[index] as MapNode[], rows[index + 1] as MapNode[])
  return { stage, rows }
}

export const findNode = (map: StageMap, id: string): MapNode | undefined =>
  map.rows.flat().find((node) => node.id === id)
