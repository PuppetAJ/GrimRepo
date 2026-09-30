// Bare `r g b` strings are for canvas `rgb()`.
export const TINT = {
  glow: '#8dffa8',
  play: '#c8f7d6',
  // Near white, since saturated green lamps turned P03 olive.
  light: '#b8f5cb',
  glowHdr: [1.6, 3.2, 2],
  // White, since green is P03's color.
  you: '#e8fff0',
  line: '205 240 215',
  gear: '140 185 155',
  field: '105 150 125',
  slot: '10 26 20',
  deep: '#0b1c14',
  screenGround: '#03150c',
  cool: '#d2f5dc',
  fill: '#a3c7b0',
  lamp: '#e6f7ea',
  spot: '#f1fbf3',
  ambient: '#1b3833',
  hemisphere: '#133029',
  fog: '#02090a',
  card: { body: '#1f3a2c', screen: '#0b2419', line: '#c4ffd4', fill: '#237350' },
  disk: { body: '#2f5a44', glow: '#0c1c14' },
} as const
