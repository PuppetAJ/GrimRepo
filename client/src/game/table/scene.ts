export type SceneName = 'cabin' | 'factory'

const KEY = 'grimrepo:scene'
const known = (name: string | null): name is SceneName => name === 'cabin' || name === 'factory'

/** Where the table is set: `?scene=` picks and remembers one; the cabin until the factory is finished. */
export function chosenScene(): SceneName {
  const asked = new URLSearchParams(window.location.search).get('scene')
  try {
    if (known(asked)) localStorage.setItem(KEY, asked)
    const saved = localStorage.getItem(KEY)
    if (known(saved)) return saved
  } catch {
    // Storage can be refused in a private window; the URL still decides for this visit.
  }
  return known(asked) ? asked : 'cabin'
}
