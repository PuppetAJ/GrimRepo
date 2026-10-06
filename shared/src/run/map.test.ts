import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encounter } from '../encounters.ts'
import { Rng } from '../rng.ts'
import { generateStage, MAP_COLUMNS } from './map.ts'
import type { MapNode, StageMap } from './types.ts'

const maps = (stage: number) => Array.from({ length: 300 }, (_, seed) => generateStage(stage, new Rng(seed)))
const UTILITIES = ['campfire', 'stones', 'event']

/** Every route from the first row to the boss, as lists of nodes. */
function routes(map: StageMap): MapNode[][] {
  const byId = new Map(map.rows.flat().map((node) => [node.id, node]))
  const from = (node: MapNode): MapNode[][] =>
    node.next.length
      ? node.next.flatMap((id) => from(byId.get(id) as MapNode).map((rest) => [node, ...rest]))
      : [[node]]
  return (map.rows[0] ?? []).flatMap(from)
}

describe('a stage map', () => {
  it('is the same for the same seed', () => {
    assert.deepEqual(generateStage(1, new Rng(42)), generateStage(1, new Rng(42)))
    assert.notDeepEqual(generateStage(1, new Rng(42)), generateStage(1, new Rng(43)))
  })

  it('opens with card choices, rests before the boss, and gives every route two to four battles', () => {
    for (const map of maps(0)) {
      const kinds = map.rows.map((row) => row.map((node) => node.kind))
      assert.equal(kinds.length, 8)
      assert.ok(kinds[0]?.every((kind) => kind === 'card'))
      assert.ok(kinds[6]?.every((kind) => UTILITIES.includes(kind)))
      assert.deepEqual(kinds[7], ['boss'])
      for (const route of routes(map)) {
        const fights = route.filter((node) => node.kind === 'battle').length
        assert.ok(fights >= 2 && fights <= 4, `a route with ${fights} battles`)
      }
    }
  })

  it('never puts the same utility twice in a row on a route', () => {
    for (const map of maps(1))
      for (const route of routes(map))
        for (let step = 1; step < route.length; step++) {
          const [before, after] = [route[step - 1] as MapNode, route[step] as MapNode]
          assert.ok(!(UTILITIES.includes(after.kind) && after.kind === before.kind), `${before.id} then ${after.id}`)
        }
  })

  it('spreads out: at least 17 nodes below the boss, reaching both sides in at least three rows', () => {
    for (const stage of [0, 1, 2])
      for (const map of maps(stage)) {
        const nodes = map.rows.slice(0, -1).flat()
        const rows = (side: (col: number) => boolean) =>
          new Set(nodes.filter((node) => side(node.col)).map((node) => node.row)).size
        assert.ok(nodes.length >= 17)
        assert.ok(rows((col) => col < 2) >= 3 && rows((col) => col > 2) >= 3)
      }
  })

  it('offers real choices: more than one start, and routes that split and merge', () => {
    for (const map of maps(2)) {
      assert.ok((map.rows[0]?.length ?? 0) >= 2)
      assert.ok(routes(map).length >= 3)
    }
  })

  it('steps one column at most, leads every node onward, and never crosses links', () => {
    for (const map of maps(2)) {
      for (let index = 0; index < map.rows.length - 2; index++) {
        const row = map.rows[index] as MapNode[]
        const next = map.rows[index + 1] as MapNode[]
        const edges = row.flatMap((node) => node.next.map((id) => [node.col, Number(id.split('-')[1])] as const))
        assert.ok(row.every((node) => node.next.length > 0))
        assert.ok(next.every((node) => edges.some(([, to]) => to === node.col)))
        for (const [a, b] of edges) {
          assert.ok(Math.abs(a - b) <= 1 && b >= 0 && b < MAP_COLUMNS)
          for (const [c, d] of edges) assert.ok(!(a < c && b > d), `row ${index}: ${a}-${b} crosses ${c}-${d}`)
        }
      }
      assert.ok(
        map.rows[6]?.every((node) => node.next.length === 1),
        'the last row leads to the boss',
      )
    }
  })

  it('draws its battles and boss from its own stage', () => {
    for (const stage of [0, 1, 2])
      for (const map of maps(stage).slice(0, 50))
        for (const node of map.rows.flat())
          if (node.encounter) {
            assert.equal(encounter(node.encounter).stage, stage)
            assert.equal(encounter(node.encounter).boss, node.kind === 'boss')
          }
  })
})
