// Runs the browser suites one after another, in Chromium and then Firefox; they share a database, so never in parallel.
// Usage: node e2e/run.mjs [suite ...] [--browser=chromium|firefox]
import { spawn } from 'node:child_process'

const suites = ['smoke', 'auth', 'leaderboard', 'game', 'table']
const engines = ['chromium', 'firefox']
const args = process.argv.slice(2)
const only = args.find((arg) => arg.startsWith('--browser='))?.slice('--browser='.length)
const wanted = args.filter((arg) => !arg.startsWith('--'))
const unknown = wanted.filter((name) => !suites.includes(name))
if (unknown.length || (only && !engines.includes(only))) {
  console.error(`Try suites from ${suites.join(', ')}, and --browser= one of ${engines.join(', ')}.`)
  process.exit(2)
}

const failed = []
for (const engine of only ? [only] : engines) {
  for (const suite of wanted.length ? wanted : suites) {
    console.log(`\n${'='.repeat(60)}\n${suite} in ${engine}\n${'='.repeat(60)}`)
    const code = await new Promise((resolve) => {
      spawn(process.execPath, [`e2e/${suite}.mjs`], {
        stdio: 'inherit',
        env: { ...process.env, E2E_BROWSER: engine },
      }).on('close', resolve)
    })
    if (code !== 0) failed.push(`${suite} in ${engine}`)
  }
}

console.log(failed.length ? `\nFailed: ${failed.join(', ')}` : '\nEvery suite passed')
process.exit(failed.length ? 1 : 0)
