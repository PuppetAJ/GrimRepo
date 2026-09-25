export type GemsName = 'built' | 'module'
export type PaletteName = 'cyan' | 'green'

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

/** The factory's light while the two are compared: `?palette=green` for P03's phosphor green, `?palette=cyan` for the first. */
export const chosenPalette = (): PaletteName => remembered('palette', ['cyan', 'green'], 'cyan')
