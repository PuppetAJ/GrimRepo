/** Resets to the demo state; `--if-empty` only seeds an empty database, and production needs SEED_ALLOW_PRODUCTION=1. */
import { randomUUID } from 'node:crypto'
import { RULES_VERSION, RUN_RULES_VERSION, scoreRun } from 'shared'
import { auth } from '../auth/auth.ts'
import { demoAccount } from '../auth/demo.ts'
import { pool } from '../config/db.ts'
import { isProduction } from '../config/env.ts'

const ifEmpty = process.argv.includes('--if-empty')

// One run each: how far it got, and whether it cleared Production.
type SeededRun = { cleared: boolean; stage: number; battles: number; bosses: number }
const cleared = (battles: number): SeededRun => ({ cleared: true, stage: 2, battles, bosses: 3 })
const lost = (stage: number, battles: number): SeededRun => ({ cleared: false, stage, battles, bosses: stage })

const histories: Record<string, SeededRun[]> = {
  JohanH: [cleared(9), lost(1, 5), cleared(11), lost(2, 8), lost(0, 2)],
  PuppetAJ: [lost(1, 4), cleared(10), lost(0, 1), cleared(9)],
  kwm0304: [lost(0, 2), cleared(12), lost(1, 6)],
  demo: [lost(0, 3), cleared(9)],
}

// Seeded runs have no moves to count cards from, so favorites are set here.
const favorites: Record<string, string> = {
  JohanH: 'RubberDuck',
  PuppetAJ: 'ForkBomb',
  kwm0304: 'SQLInjection',
  demo: 'CopyPaste',
}

const players = [
  demoAccount,
  // Random passwords, so nobody can sign in as these accounts.
  ...['JohanH', 'PuppetAJ', 'kwm0304'].map((name) => ({
    name,
    username: name,
    email: `${name.toLowerCase()}@grimrepo.test`,
    password: randomUUID(),
  })),
]

async function main(): Promise<void> {
  if (ifEmpty) {
    const { rows } = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users')
    if ((rows[0]?.count ?? 0) > 0) return console.log('Players already exist; nothing seeded.')
  } else if (isProduction && process.env['SEED_ALLOW_PRODUCTION'] !== '1') {
    throw new Error('Refusing to wipe a production database without SEED_ALLOW_PRODUCTION=1')
  } else {
    await pool.query('TRUNCATE games, runs, rate_limits, verifications, users RESTART IDENTITY CASCADE')
  }

  for (const player of players) {
    // Through Better Auth, so the password is hashed as a real sign-up hashes it.
    const { user } = await auth.api.signUpEmail({ body: player })
    const runs = histories[player.username] ?? []
    for (const [index, run] of runs.entries()) {
      // Spread over recent days so the stats page has history to show.
      const favorite = favorites[player.username]
      await pool.query(
        `INSERT INTO runs (user_id, seed, rules_version, run_version, status, stage, battles, bosses, score,
                           started_at, finished_at, cards)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(days => $10), now() - make_interval(days => $10),
                 $11)`,
        [
          user.id,
          index + 1,
          RULES_VERSION,
          RUN_RULES_VERSION,
          run.cleared ? 'won' : 'lost',
          run.stage,
          run.battles,
          run.bosses,
          scoreRun({ battles: run.battles, bosses: run.bosses, overkill: 0 }, run.cleared),
          (runs.length - index) * 2,
          JSON.stringify(favorite ? { [favorite]: 2, Boilerplate: 3 } : {}),
        ],
      )
    }
  }
  console.log(`Seeded ${players.length} players.`)
}

try {
  await main()
} finally {
  await pool.end()
}
