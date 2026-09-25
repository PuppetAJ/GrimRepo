import { chosenPalette } from './scene.ts'

// The factory's light, cyan or P03's green, chosen once when the table loads. Canvas colours are `r g b` for `rgb()`.
const PALETTES = {
  cyan: {
    glow: '#3ef3ff',
    glowHdr: [0.8, 3, 3.4],
    you: '#3ef3ff',
    line: '90 216 240',
    gear: '74 159 214',
    field: '90 170 200',
    slot: '10 26 36',
    deep: '#0b1a24',
    screenGround: '#03141c',
    cool: '#9fdcff',
    fill: '#7fb8d0',
    lamp: '#bfefff',
    spot: '#d8f4ff',
    ambient: '#1a3a4a',
    hemisphere: '#123040',
    fog: '#02070c',
    card: { screen: '#0a2430', line: '#4fd9f2', fill: '#1c6f84' },
  },
  green: {
    glow: '#7dff9a',
    glowHdr: [1.2, 3.4, 1.5],
    // Green is P03's, so the player's lead shows white.
    you: '#e8fff0',
    line: '125 255 154',
    gear: '88 196 118',
    field: '100 190 130',
    slot: '10 28 18',
    deep: '#0b1d12',
    screenGround: '#03170b',
    cool: '#c4ffd2',
    fill: '#8fc8a0',
    lamp: '#d8ffe2',
    spot: '#eefff2',
    ambient: '#1f3a2a',
    hemisphere: '#143020',
    fog: '#030a06',
    card: { screen: '#0a2a18', line: '#7dff9a', fill: '#1c8450' },
  },
} as const

export const TINT = PALETTES[chosenPalette()]
