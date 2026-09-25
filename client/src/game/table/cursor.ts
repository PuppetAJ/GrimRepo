export type CursorKind = 'arrow' | 'point' | 'draw' | 'boilerplate' | 'press'

/** The CSS for one of the table's cursors, green like P03's text, falling back to the browser's own. */
export const cursorCss = (kind: CursorKind) =>
  `url(/cursors/${kind}.svg) 2 2, ${kind === 'arrow' ? 'default' : 'pointer'}`

// The thing last pointed at owns the cursor; letting go only clears it if nothing has taken it since.
let owner: object | null = null
let current: CursorKind = 'arrow'
const listeners = new Set<(kind: CursorKind) => void>()
const tell = () => listeners.forEach((listener) => listener(current))

export function claimCursor(who: object, kind: CursorKind): void {
  if (owner === who && current === kind) return
  owner = who
  current = kind
  tell()
}

export function releaseCursor(who: object): void {
  if (owner !== who) return
  owner = null
  current = 'arrow'
  tell()
}

export function onCursor(listener: (kind: CursorKind) => void): () => void {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}
