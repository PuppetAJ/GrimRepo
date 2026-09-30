/** mulberry32: its whole state is one number, so a game state can carry it. */
export function next(state: number): [value: number, state: number] {
  const advanced = (state + 0x6d2b79f5) | 0
  let t = advanced
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, advanced]
}

export class Rng {
  state: number

  constructor(state: number) {
    this.state = state
  }

  float(): number {
    const [value, state] = next(this.state)
    this.state = state
    return value
  }

  /** Includes both min and max. */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1))
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.float() * items.length)]
    if (item === undefined) throw new Error('Cannot pick from an empty list')
    return item
  }

  /** Fisher-Yates, returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1))
      ;[out[i], out[j]] = [out[j] as T, out[i] as T]
    }
    return out
  }
}
