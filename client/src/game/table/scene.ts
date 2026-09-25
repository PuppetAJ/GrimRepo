export type GemsName = 'built' | 'module'
export type PaletteName = 'cyan' | 'green'
export type TextName = 'classic' | 'act2'

/** A choice made with `?name=` in the URL and remembered after; `fallback` until one is made. */
export function remembered<T extends string>(name: string, options: readonly T[], fallback: T): T {
  const known = (value: string | null): value is T => options.includes(value as T)
  const key = `grimrepo:${name}`
  const asked = new URLSearchParams(window.location.search).get(name)
  try {
    if (known(asked)) localStorage.setItem(key, asked)
    const saved = localStorage.getItem(key)
    if (known(saved)) return saved
  } catch {
    // Storage can be refused in a private window; the URL still decides for this visit.
  }
  return known(asked) ? asked : fallback
}

/** The factory's gems while the two are compared: `?gems=module` for the drone's module, `?gems=built` for the ones built in code. */
export const chosenGems = (): GemsName => remembered('gems', ['built', 'module'], 'built')

/** The factory's light: P03's green, or `?palette=cyan` for the first, kept while the mood is compared. */
export const chosenPalette = (): PaletteName => remembered('palette', ['cyan', 'green'], 'green')

/** The text table while two are compared: `?text=act2` for the one laid out like Act 2, `?text=classic` for the first. */
export const chosenText = (): TextName => remembered('text', ['classic', 'act2'], 'classic')

/** Picks a text table and remembers it, as `?text=` would. */
export function chooseText(name: TextName): void {
  try {
    localStorage.setItem('grimrepo:text', name)
  } catch {
    // Storage can be refused in a private window; the choice lasts until the page reloads.
  }
}
