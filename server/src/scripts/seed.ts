/** Resets to the demo state; `--if-empty` only seeds an empty database, and production needs SEED_ALLOW_PRODUCTION=1. */
import { randomUUID } from 'node:crypto'
import { scoreBattle, type Outcome } from 'shared'
import { auth } from '../auth/auth.ts'
import { demoAccount } from '../auth/demo.ts'
import { pool } from '../config/db.ts'
import { isProduction } from '../config/env.ts'

const ifEmpty = process.argv.includes('--if-empty')

// Won in few turns, lost late, and so on; each pair is one game as [outcome, turns].
const histories: Record<string, [Outcome, number][]> = {
  JohanH: [
    ['win', 9],
    ['loss', 14],
    ['win', 12],
    ['win', 18],
    ['loss', 6],
  ],
  PuppetAJ: [
    ['loss', 11],
    ['win', 15],
    ['loss', 4],
    ['win', 21],
  ],
  kwm0304: [
    ['loss', 8],
    ['win', 24],
    ['loss', 13],
  ],
  demo: [
    ['loss', 7],
    ['win', 19],
  ],
}

const players = [
  demoAccount,
  // The original team keeps its names; nobody can sign in as them, since nobody knows the password.
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
    await pool.query('TRUNCATE games, rate_limits, verifications, users RESTART IDENTITY CASCADE')
  }

  for (const player of players) {
    // Through Better Auth, so the password is hashed exactly as a real sign-up would hash it.
    const { user } = await auth.api.signUpEmail({ body: player })
    const games = histories[player.username] ?? []
    for (const [index, [outcome, turns]] of games.entries()) {
      // Spread across recent days, newest last, so the stats page has some history to show.
      await pool.query(
        `INSERT INTO games (user_id, outcome, turns, score, played_at)
         VALUES ($1, $2, $3, $4, now() - make_interval(days => $5))`,
        [user.id, outcome, turns, scoreBattle(outcome, turns), (games.length - index) * 2],
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
