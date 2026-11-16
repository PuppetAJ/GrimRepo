const base = JSON.parse(process.env.MATRIX)
const changed = process.env.CHANGED?.split('\n').filter(Boolean)

const key = (entry) => (entry.part ? `${entry.suite}:${entry.part}` : entry.suite)
const GAME = ['table', 'run-mode', 'run-3d', 'tutorial', 'a11y:run', 'a11y:tables']

const REACH = [
  ['client/src/game/run/', ['run-mode', 'run-3d', 'a11y:run', 'a11y:tables']],
  ['client/src/game/tutorial/', ['tutorial']],
  ['client/src/game/table/', ['table', 'run-3d', 'tutorial', 'a11y:tables']],
  ['client/src/game/text/', ['table', 'run-mode', 'tutorial', 'a11y:run', 'a11y:tables']],
  ['client/src/game/', GAME],
  ['client/src/pages/Board.tsx', ['table', 'a11y:tables']],
  ['client/src/pages/Run.tsx', GAME],
  ['client/src/pages/Mockups.tsx', GAME],
  ['client/src/pages/Tutorial.tsx', ['tutorial']],
  ['client/src/pages/', ['smoke', 'auth', 'leaderboard', 'a11y:pages']],
  ['server/src/', ['smoke', 'auth', 'leaderboard', 'run-mode', 'a11y:pages']],
]

function reached() {
  if (!changed?.length) return null
  const keys = new Set()
  for (const file of changed) {
    const spec = /^e2e\/([\w-]+)\.spec\.mjs$/.exec(file)
    if (spec) {
      for (const entry of base) if (entry.suite === spec[1]) keys.add(key(entry))
      continue
    }
    const folder = REACH.find(([prefix]) => file.startsWith(prefix))
    if (!folder) return null
    for (const name of folder[1]) keys.add(name)
  }
  return keys
}

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
