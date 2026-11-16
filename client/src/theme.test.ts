import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

const token = (name: string) => {
  const hex = css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, 'i'))?.[1]
  assert.ok(hex, `--${name} is a six-digit hex color`)
  return hex
}

const luminance = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (one: string, two: string) => {
  const [light, dark] = [luminance(token(one)), luminance(token(two))].sort((a, b) => b - a) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

describe('the theme', () => {
  it("draws a field's edge at 3:1 against the page", () => {
    assert.ok(contrast('input', 'background') >= 3)
  })

  it("draws P03's panel, button and lane edges at 3:1 against the table", () => {
    assert.ok(contrast('p03-edge', 'p03-ground') >= 3)
  })
})
