import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import {
  applyRun,
  createRun,
  playRun,
  replayRun,
  RULES_VERSION,
  RUN_RULES_VERSION,
  scoreRun,
  type RunAction,
  type RunState,
} from 'shared'
import { pool } from '../config/db.ts'
import { countRunCardsPlayed, HISTORY_PAGE, RECENT_RUNS, runCardsPlayed } from '../db/players.ts'
import { BOARD_PAGE } from '../db/runs.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { insertPlayer, insertRun, resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

async function signedIn(prefix?: string) {
  const player = newPlayer(prefix)
  const reply = await app.call('POST', '/api/auth/sign-up/email', { body: player })
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  return { ...player, cookie: reply.cookie }
}

const cleared = (battles = 9) => ({ cleared: true, stage: 2, battles, bosses: 3 })
const score = (run: { cleared?: boolean; battles?: number; bosses?: number }) =>
  scoreRun({ battles: run.battles ?? 0, bosses: run.bosses ?? 0, overkill: 0 }, run.cleared ?? false)

describe('the leaderboard', () => {
  it('ranks players by their best run', async () => {
    const short = await signedIn('short')
    const far = await signedIn('far')
    await insertRun(short.username, { battles: 2 })
    await insertRun(far.username, cleared())
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { username: string }) => row.username),
      [far.username, short.username],
    )
    assert.equal(body.players[0].rank, 1)
  })

  it('keeps a best score when a worse run follows it, counting every run and the ones cleared', async () => {
    const player = await signedIn()
    await insertRun(player.username, cleared())
    await insertRun(player.username, { battles: 1 })
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.equal(body.players[0].bestScore, score(cleared()))
    assert.deepEqual([body.players[0].runs, body.players[0].wins], [2, 1])
  })

  it('gives tied players the same rank', async () => {
    const one = await signedIn('tied')
    const two = await signedIn('tied')
    await insertRun(one.username, { battles: 4, bosses: 1, stage: 1 })
    await insertRun(two.username, { battles: 4, bosses: 1, stage: 1 })
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { rank: number }) => row.rank),
      [1, 1],
    )
  })

  it('pages twenty at a time, ranking across every page', async () => {
    for (let n = 0; n < 23; n++) {
      await insertPlayer(`many_${n}`)
      await insertRun(`many_${n}`, { battles: 30 - n })
    }
    const first = (await app.call('GET', '/api/leaderboard')).body
    assert.deepEqual([first.page, first.pages, first.total, first.players.length], [1, 2, 23, BOARD_PAGE])
    assert.equal(first.top, score({ battles: 30 }))
    const second = (await app.call('GET', '/api/leaderboard?page=2')).body
    assert.deepEqual(
      second.players.map((row: { rank: number }) => row.rank),
      [21, 22, 23],
    )
    assert.equal((await app.call('GET', '/api/leaderboard?page=9')).body.page, 2, 'a page past the end is the last one')
  })

  it('leaves out players who have never finished a run', async () => {
    await signedIn()
    assert.deepEqual((await app.call('GET', '/api/leaderboard')).body.players, [])
  })

  it('never shows an email address', async () => {
    const player = await signedIn()
    await insertRun(player.username, cleared())
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.ok(!JSON.stringify(body).includes('@'), JSON.stringify(body))
  })
})

describe('a player’s stats', () => {
  it('add up runs cleared and lost, a forfeit among the losses', async () => {
    const player = await signedIn('Mixed')
    await insertRun(player.username, { ...cleared(10), daysAgo: 4 })
    await insertRun(player.username, { battles: 3, daysAgo: 3 })
    await insertRun(player.username, { ...cleared(8), daysAgo: 2 })
    await insertRun(player.username, { battles: 0, forfeited: true, daysAgo: 1 })

    const { status, body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(status, 200)
    assert.equal(body.username, player.username)
    assert.deepEqual([body.runs, body.wins, body.losses, body.winRate], [4, 2, 2, 0.5])
    assert.equal(body.bestScore, score(cleared(10)))
    assert.equal(body.averageBattles, 5.3)
    assert.deepEqual(
      body.recent.map((run: { battles: number; outcome: string; forfeited: boolean }) => [
        run.battles,
        run.outcome,
        run.forfeited,
      ]),
      [
        [0, 'loss', true],
        [8, 'win', false],
        [3, 'loss', false],
        [10, 'win', false],
      ],
      'newest first',
    )
  })

  it('keep the newest runs, enough for the charts and no more', async () => {
    const player = await signedIn()
    for (let day = 0; day < RECENT_RUNS + 5; day++) await insertRun(player.username, { battles: day, daysAgo: day })
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.recent.length, RECENT_RUNS)
    assert.equal(body.recent[0].battles, 0, 'the newest first')
  })

  it('leave out a run still being played', async () => {
    const player = await signedIn()
    await insertRun(player.username, cleared())
    await app.call('POST', '/api/runs', { cookie: player.cookie })
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.deepEqual([body.runs, body.recent.length], [1, 1])
  })

  it('page through a player’s history, newest first, ten at a time', async () => {
    const player = await signedIn()
    for (let day = 0; day < 25; day++) await insertRun(player.username, { battles: day, daysAgo: day })
    const first = await app.call('GET', `/api/players/${player.username}/runs`)
    assert.equal(first.status, 200)
    assert.deepEqual([first.body.page, first.body.pages, first.body.total], [1, 3, 25])
    assert.equal(first.body.runs.length, HISTORY_PAGE)
    assert.equal(first.body.runs[0].battles, 0, 'the newest first')
    const last = await app.call('GET', `/api/players/${player.username}/runs?page=3`)
    assert.deepEqual([last.body.page, last.body.runs.length, last.body.runs[4].battles], [3, 5, 24])
    const past = await app.call('GET', `/api/players/${player.username}/runs?page=99`)
    assert.equal(past.body.page, 3, 'a page past the end is the last one')
    const nonsense = await app.call('GET', `/api/players/${player.username}/runs?page=abc`)
    assert.equal(nonsense.body.page, 1)
    const nobody = await app.call('GET', '/api/players/nobody_at_all/runs')
    assert.equal(nobody.status, 404)
  })

  it('count runs per day for the activity grid', async () => {
    const player = await signedIn()
    await insertRun(player.username, { ...cleared(), daysAgo: 3 })
    await insertRun(player.username, { battles: 2, daysAgo: 3 })
    await insertRun(player.username, { battles: 2, daysAgo: 1 })
    await insertRun(player.username, { ...cleared(), daysAgo: 400 })
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.deepEqual(
      body.days.map((day: { runs: number; losses: number }) => [day.runs, day.losses]),
      [
        [2, 1],
        [1, 1],
      ],
      'a run from more than half a year ago is not in the grid',
    )
  })

  it('are public and found whatever the case of the name', async () => {
    const player = await signedIn('CaseSensitive')
    await insertRun(player.username, cleared())
    const reply = await app.call('GET', `/api/players/${player.username.toLowerCase()}/stats`)
    assert.equal(reply.status, 200)
    assert.equal(reply.body.username, player.username)
  })

  it('exist, empty, for a player who has not played', async () => {
    const player = await signedIn()
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.runs, 0)
    assert.equal(body.winRate, null)
    assert.equal(body.averageBattles, null)
    assert.deepEqual(body.recent, [])
  })

  it('are a 404 for nobody, or for a name that could not exist', async () => {
    assert.equal((await app.call('GET', '/api/players/nobody_here/stats')).status, 404)
    assert.equal((await app.call('GET', '/api/players/no%20spaces/stats')).status, 404)
  })

  it('never include an email address', async () => {
    const player = await signedIn()
    await insertRun(player.username, cleared())
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.ok(!JSON.stringify(body).includes('@'))
  })

  it('give the best run, the first time that score was reached, even past the recent runs', async () => {
    const player = await signedIn()
    await insertRun(player.username, { ...cleared(), daysAgo: 60 })
    await insertRun(player.username, { ...cleared(), daysAgo: 50 })
    for (let day = 0; day < RECENT_RUNS; day++) await insertRun(player.username, { battles: 2, daysAgo: day })
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.best.score, score(cleared()))
    assert.equal(body.best.bosses, 3)
    assert.ok(Date.now() - Date.parse(body.best.playedAt) > 55 * 86_400_000, 'the earlier of the two')
    assert.ok(!body.recent.some((run: { bosses: number }) => run.bosses === 3), 'older than the recent runs')
  })

  it('rank a player as the leaderboard does, and leave a guest or a newcomer unranked', async () => {
    const first = await signedIn()
    const second = await signedIn()
    const tied = await signedIn()
    await insertRun(first.username, cleared())
    await insertRun(second.username, { battles: 3 })
    await insertRun(tied.username, { battles: 3 })
    const rank = async (username: string) =>
      (await app.call('GET', `/api/players/${username}/stats`)).body.rank as number | null
    assert.deepEqual([await rank(first.username), await rank(second.username), await rank(tied.username)], [1, 2, 2])
    const newcomer = await signedIn()
    assert.equal(await rank(newcomer.username), null)
    await pool.query(`UPDATE users SET is_anonymous = true WHERE username = lower($1)`, [first.username])
    assert.equal(await rank(first.username), null, 'a guest is off the board')
    assert.equal(await rank(second.username), 1)
  })

  it('name the card played most across every run, Boilerplate aside', async () => {
    const player = await signedIn()
    await insertRun(player.username, { battles: 5, daysAgo: 2, cards: { RubberDuck: 2, Boilerplate: 9, Bug: 1 } })
    await insertRun(player.username, { battles: 2, daysAgo: 1, cards: { Bug: 2 } })
    await insertRun(player.username, { battles: 1 })
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.favoriteCard, 'Bug')
    const newcomer = await signedIn()
    assert.equal((await app.call('GET', `/api/players/${newcomer.username}/stats`)).body.favoriteCard, null)
  })

  it('count the cards of runs finished before cards were counted, once, and none for older rules', async () => {
    const player = await signedIn()
    const seed = 4242
    const { state, actions } = playRun(createRun({ seed }), (now: RunState, action: RunAction) => {
      const result = applyRun(now, action)
      if (!result.ok) throw new Error(result.reason)
      return result.state
    })
    const replayed = replayRun(seed, actions)
    assert.ok(replayed.ok)
    const finish = (runVersion: number) =>
      pool.query(
        `INSERT INTO runs (user_id, seed, rules_version, run_version, actions, status, score, finished_at)
         SELECT id, $2, $3, $4, $5, $6, 0, now() FROM users WHERE username = lower($1)`,
        [player.username, seed, RULES_VERSION, runVersion, JSON.stringify(actions), state.status],
      )
    await finish(RUN_RULES_VERSION)
    await finish(RUN_RULES_VERSION - 1)
    assert.equal(await countRunCardsPlayed(), 2)
    const { rows } = await pool.query<{ cards: Record<string, number> }>('SELECT cards FROM runs ORDER BY id')
    assert.deepEqual(
      rows.map((row) => row.cards),
      [runCardsPlayed(replayed.events), {}],
      'an older run may not replay as it was played, so it counts nothing',
    )
    assert.equal(await countRunCardsPlayed(), 0, 'and not again')
  })
})
