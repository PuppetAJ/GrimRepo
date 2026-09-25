import { chosenPalette } from './scene.ts'

// The factory's light, green or the first cyan, chosen once when the table loads. Canvas colours are `r g b` for `rgb()`.
const PALETTES = {
  cyan: {
    glow: '#3ef3ff',
    light: '#3ef3ff',
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
    card: { body: '#1f3044', screen: '#0a2430', line: '#4fd9f2', fill: '#1c6f84' },
    disk: { body: '#2e4664', glow: '#0c1826' },
  },
  green: {
    glow: '#8dffa8',
    // Lamps near white with a green cast, as the cyan's were near white with a blue one; saturated green made P03 olive.
    light: '#b8f5cb',
    glowHdr: [1.6, 3.2, 2],
    // Green is P03's, so the player's lead shows white.
    you: '#e8fff0',
    line: '160 240 185',
    gear: '96 176 128',
    field: '105 165 130',
    slot: '10 26 20',
    deep: '#0b1c14',
    screenGround: '#03150c',
    cool: '#d2f5dc',
    fill: '#a3c7b0',
    lamp: '#e6f7ea',
    spot: '#f1fbf3',
    // Shadows lean teal, keeping the cyan's cool.
    ambient: '#1b3833',
    hemisphere: '#133029',
    fog: '#02090a',
    // The holograms lean white, as the cyan's did.
    card: { body: '#1f3a2c', screen: '#0b2419', line: '#c4ffd4', fill: '#237350' },
    disk: { body: '#2f5a44', glow: '#0c1c14' },
  },
} as const

export const TINT = PALETTES[chosenPalette()]
