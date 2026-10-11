import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { CARD, SECTIONS } from './layout.ts'

// The worn texture's tile, as the disk's UVs were projected from its face before the sections were anchored.
const TILE = 0.9
const ANCHORS = { top: CARD.height / 2, middle: (0.5 - SECTIONS.middleTop) * CARD.height, bottom: -CARD.height / 2 }

// The model's own numbers, from its glTF header: every position accessor records its bounds.
const glb = readFileSync(new URL('../../../public/models/disk.glb', import.meta.url))
const headerLength = glb.readUInt32LE(12)
const header = JSON.parse(glb.toString('utf8', 20, 20 + headerLength)) as {
  nodes: { name: string; mesh: number }[]
  meshes: { primitives: { attributes: { POSITION: number; TEXCOORD_0: number } }[] }[]
  accessors: { min: number[]; max: number[]; count: number; bufferView: number; byteOffset?: number }[]
  bufferViews: { byteOffset?: number }[]
}
const body = glb.subarray(20 + headerLength + 8)
/** An accessor's floats, read from the model's binary chunk. */
const floats = (index: number, size: number) => {
  const accessor = header.accessors[index]
  assert.ok(accessor)
  const start = (header.bufferViews[accessor.bufferView]?.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return new Float32Array(
    body.buffer.slice(body.byteOffset + start, body.byteOffset + start + accessor.count * size * 4),
  )
}
const bounds = (name: string) => {
  const node = header.nodes.find((found) => found.name === name)
  assert.ok(node, `the model has ${name}`)
  const accessor = header.accessors[header.meshes[node.mesh]?.primitives[0]?.attributes.POSITION ?? -1]
  assert.ok(accessor)
  return accessor
}
const close = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-5, `${what}: ${actual}, expected ${expected}`)

describe('the disk modeled in Blender', () => {
  it('has every section in every material the game draws, and its rails', () => {
    for (const section of ['top', 'middle', 'bottom'])
      for (const material of ['plastic', 'dark', 'metal']) bounds(`${section}_${material}`)
    bounds('rail_metal')
  })

  it("is the card's width, so the faces drawn for it fit", () => {
    for (const section of ['top', 'middle', 'bottom']) {
      const { min, max } = bounds(`${section}_plastic`)
      close((max[0] ?? 0) - (min[0] ?? 0), CARD.width, `${section}'s width`)
    }
  })

  it('anchors each section at its edge, the middle exactly as tall as its share of the face', () => {
    close(bounds('top_plastic').max[1] ?? 1, 0, "the top's upper edge")
    close(bounds('bottom_plastic').min[1] ?? 1, 0, "the bottom's lower edge")
    const middle = bounds('middle_plastic')
    close(middle.max[1] ?? 1, 0, "the middle's upper edge")
    close(-(middle.min[1] ?? 0), (SECTIONS.middleBottom - SECTIONS.middleTop) * CARD.height, "the middle's height")
  })

  it('maps the worn texture straight off the face, V upward, as the game textures it', () => {
    // Blender's exporter flips V; the model stores it flipped so it comes out the game's way, and a re-export mustn't undo that.
    for (const [section, anchor] of Object.entries(ANCHORS)) {
      const node = header.nodes.find((found) => found.name === `${section}_plastic`)
      const attributes = header.meshes[node?.mesh ?? -1]?.primitives[0]?.attributes
      assert.ok(attributes)
      const position = floats(attributes.POSITION, 3)
      const uv = floats(attributes.TEXCOORD_0, 2)
      for (let i = 0; i < position.length / 3; i += 7) {
        close(uv[i * 2] ?? 0, ((position[i * 3] ?? 0) + CARD.width / 2) / TILE, `${section}'s u`)
        close(uv[i * 2 + 1] ?? 0, ((position[i * 3 + 1] ?? 0) + anchor + CARD.height / 2) / TILE, `${section}'s v`)
      }
    }
  })
})
