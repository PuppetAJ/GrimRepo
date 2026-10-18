// Picks the browser suites to run and splits the slowest over two runners. MATRIX is every suite the event runs. On a
// pull request, CHANGED lists its changed files, one per line, and only the suites they can reach are kept: a file in
// one of the folders below narrows the run to that folder's suites, and any other file runs them all. The nightly run
// has no CHANGED, so it runs everything and catches whatever a narrowed pull request missed.
const base = JSON.parse(process.env.MATRIX)
const changed = process.env.CHANGED?.split('\n').filter(Boolean)

const key = (entry) => (entry.part ? `${entry.suite}:${entry.part}` : entry.suite)
const GAME = ['game', 'table', 'run-mode', 'run-3d', 'tutorial', 'a11y:run', 'a11y:tables']

// Most specific first; each file takes the first folder it starts with.
const REACH = [
  ['client/src/game/run/', ['run-mode', 'run-3d', 'a11y:run', 'a11y:tables']],
  ['client/src/game/tutorial/', ['tutorial']],
  ['client/src/game/table/', ['table', 'run-3d', 'tutorial', 'a11y:tables']],
  ['client/src/game/text/', ['game', 'table', 'run-mode', 'tutorial', 'a11y:run', 'a11y:tables']],
  ['client/src/game/', GAME],
  // The pages that hold the tables are the game's, not the site's.
  ['client/src/pages/Game.tsx', GAME],
  ['client/src/pages/Run.tsx', GAME],
  ['client/src/pages/Mockups.tsx', GAME],
  ['client/src/pages/Tutorial.tsx', ['tutorial']],
  ['client/src/pages/', ['smoke', 'auth', 'leaderboard', 'a11y:pages']],
  // The site's pages show what the API sends, so they're checked against it too.
  ['server/src/', ['smoke', 'auth', 'leaderboard', 'game', 'run-mode', 'a11y:pages']],
]

function reached() {
  // Unsure what changed, every suite runs: a picker that can't tell must err toward more, never toward none.
  if (!changed?.length) return null
  const keys = new Set()
  for (const file of changed) {
    const spec = /^e2e\/([\w-]+)\.spec\.mjs$/.exec(file)
    if (spec) {
      // A suite's own file runs that suite, all its parts.
      for (const entry of base) if (entry.suite === spec[1]) keys.add(key(entry))
      continue
    }
    const folder = REACH.find(([prefix]) => file.startsWith(prefix))
    // Anything else, such as the rules, shared components, the test helpers or the dependencies, could reach any page.
    if (!folder) return null
    for (const name of folder[1]) keys.add(name)
  }
  return keys
}

// The suites whose tests share out well; the 3D table's is mostly one long game, so it stays whole.
const SHARDS = { 'run-3d': 2, 'a11y:run': 2 }

const keep = reached()
const plan = base
  .filter((entry) => !keep || keep.has(key(entry)))
  .flatMap((entry) => {
    const shards = SHARDS[key(entry)]
    return shards
      ? Array.from({ length: shards }, (_, index) => ({ ...entry, shard: `${index + 1}/${shards}`, share: index + 1 }))
      : [entry]
  })

console.log(JSON.stringify(plan))
