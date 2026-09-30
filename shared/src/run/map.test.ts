import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encounter } from '../encounters.ts'
import { Rng } from '../rng.ts'
import { generateStage } from './map.ts'
import type { MapNode } from './types.ts'

const maps = (stage: number) => Array.from({ length: 300 }, (_, seed) => generateStage(stage, new Rng(seed)))

describe('a stage map', () => {
  it('is the same for the same seed', () => {
    assert.deepEqual(generateStage(1, new Rng(42)), generateStage(1, new Rng(42)))
    assert.notDeepEqual(generateStage(1, new Rng(42)), generateStage(1, new Rng(43)))
  })

  it('runs card, utility and battle twice, then two utilities and the boss', () => {
    for (const map of maps(0)) {
      const kinds = map.rows.map((row) => row.map((node) => node.kind))
      assert.equal(kinds.length, 8)
      for (const index of [0, 3]) assert.ok(kinds[index]?.every((kind) => kind === 'card'))
      for (const index of [2, 5]) assert.ok(kinds[index]?.every((kind) => kind === 'battle'))
      for (const index of [1, 4])
        assert.ok(kinds[index]?.every((kind) => ['campfire', 'stones', 'event'].includes(kind)))
      assert.equal(new Set(kinds[6]).size, 2, 'the rest row offers two different utilities')
      assert.deepEqual(kinds[7], ['boss'])
      for (const row of map.rows) assert.ok(row.length >= 1 && row.length <= 3)
    }
  })

  it('leads every node onward and every node is reachable, with no paths crossing', () => {
    for (const map of maps(2)) {
      for (let index = 0; index < map.rows.length - 1; index++) {
        const row = map.rows[index] as MapNode[]
        const next = map.rows[index + 1] as MapNode[]
        const edges = row.flatMap((node) => node.next.map((id) => [node.col, Number(id.split('-')[1])] as const))
        assert.ok(row.every((node) => node.next.length > 0))
        assert.ok(next.every((node) => edges.some(([, to]) => to === node.col)))
        for (const [a, b] of edges)
          for (const [c, d] of edges) assert.ok(!(a < c && b > d), `row ${index}: ${a}-${b} crosses ${c}-${d}`)
      }
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
