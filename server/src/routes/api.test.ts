import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { scoreBattle } from 'shared'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

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

const play = (cookie: string, outcome: string, turns: number) =>
  app.call('POST', '/api/games', { cookie, body: { outcome, turns } })

describe('recording a game', () => {
  it('refuses someone who is not signed in', async () => {
    const reply = await app.call('POST', '/api/games', { body: { outcome: 'win', turns: 5 } })
    assert.equal(reply.status, 401)
    assert.equal((await pool.query('SELECT 1 FROM games')).rowCount, 0)
  })

  it('scores the game on the server', async () => {
    const player = await signedIn()
    const reply = await play(player.cookie, 'win', 8)
    assert.equal(reply.status, 201)
    assert.equal(reply.body.score, scoreBattle('win', 8))
  })

  it('refuses a score sent by the client', async () => {
    // The old app wrote whatever score the browser sent; this is the one-line exploit it had.
    const player = await signedIn()
    const reply = await app.call('POST', '/api/games', {
      cookie: player.cookie,
      body: { outcome: 'win', turns: 8, score: 1_000_000 },
    })
    assert.equal(reply.status, 400)
  })

  it('refuses a game no rules could produce', async () => {
    const player = await signedIn()
    for (const body of [
      { outcome: 'win', turns: 0 },
      { outcome: 'win', turns: 201 },
      { outcome: 'win', turns: 2.5 },
      { outcome: 'draw', turns: 5 },
      { outcome: 'win' },
      {},
    ]) {
      const reply = await app.call('POST', '/api/games', { cookie: player.cookie, body })
      assert.equal(reply.status, 400, JSON.stringify(body))
    }
  })

  it('answers malformed JSON with a 400, not a stack trace', async () => {
    const player = await signedIn()
    const reply = await app.call('POST', '/api/games', { cookie: player.cookie, raw: '{"outcome": "win",' })
    assert.equal(reply.status, 400)
    assert.equal(reply.body.error, 'Malformed JSON')
  })

  it('refuses a body far larger than any game', async () => {
    const player = await signedIn()
    const reply = await app.call('POST', '/api/games', {
      cookie: player.cookie,
      raw: JSON.stringify({ pad: 'x'.repeat(40_000) }),
    })
    assert.equal(reply.status, 413)
  })
})

describe('the leaderboard', () => {
  it('ranks players by their best game', async () => {
    const slow = await signedIn('slow')
    const fast = await signedIn('fast')
    await play(slow.cookie, 'win', 25)
    await play(fast.cookie, 'win', 6)

    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { username: string }) => row.username),
      [fast.username, slow.username],
    )
    assert.equal(body.players[0].rank, 1)
  })

  it('keeps a best score when a worse game follows it', async () => {
    const player = await signedIn()
    await play(player.cookie, 'win', 6)
    const worse = await play(player.cookie, 'loss', 3)
    assert.equal(worse.body.isBest, false)

    const { body } = await app.call('GET', '/api/leaderboard')
    assert.equal(body.players[0].bestScore, scoreBattle('win', 6))
    assert.equal(body.players[0].games, 2, 'the worse game still counts as a game')
  })

  it('gives tied players the same rank', async () => {
    const one = await signedIn('tied')
    const two = await signedIn('tied')
    await play(one.cookie, 'win', 10)
    await play(two.cookie, 'win', 10)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(
      body.players.map((row: { rank: number }) => row.rank),
      [1, 1],
    )
  })

  it('leaves out players who have never finished a game', async () => {
    await signedIn()
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.deepEqual(body.players, [])
  })

  it('never shows an email address', async () => {
    const player = await signedIn()
    await play(player.cookie, 'win', 10)
    const { body } = await app.call('GET', '/api/leaderboard')
    assert.ok(!JSON.stringify(body).includes('@'), JSON.stringify(body))
  })
})

describe('a player’s stats', () => {
  it('add up after a mix of wins and losses', async () => {
    const player = await signedIn('Mixed')
    for (const [outcome, turns] of [
      ['win', 12],
      ['loss', 4],
      ['win', 9],
      ['loss', 20],
    ] as const) {
      await play(player.cookie, outcome, turns)
    }

    const { status, body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(status, 200)
    assert.equal(body.username, player.username)
    assert.equal(body.games, 4)
    assert.equal(body.wins, 2)
    assert.equal(body.losses, 2)
    assert.equal(body.winRate, 0.5)
    assert.equal(body.bestScore, scoreBattle('win', 9))
    assert.equal(body.bestWinTurns, 9)
    assert.equal(body.averageTurns, 11.3)
    assert.deepEqual(
      body.recent.map((game: { turns: number }) => game.turns),
      [20, 9, 4, 12],
      'newest first',
    )
  })

  it('are public and found whatever the case of the name', async () => {
    const player = await signedIn('CaseSensitive')
    await play(player.cookie, 'win', 10)
    const reply = await app.call('GET', `/api/players/${player.username.toLowerCase()}/stats`)
    assert.equal(reply.status, 200)
    assert.equal(reply.body.username, player.username)
  })

  it('exist, empty, for a player who has not played', async () => {
    const player = await signedIn()
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.equal(body.games, 0)
    assert.equal(body.winRate, null)
    assert.deepEqual(body.recent, [])
  })

  it('are a 404 for nobody, or for a name that could not exist', async () => {
    assert.equal((await app.call('GET', '/api/players/nobody_here/stats')).status, 404)
    assert.equal((await app.call('GET', '/api/players/no%20spaces/stats')).status, 404)
  })

  it('never include an email address', async () => {
    const player = await signedIn()
    await play(player.cookie, 'win', 10)
    const { body } = await app.call('GET', `/api/players/${player.username}/stats`)
    assert.ok(!JSON.stringify(body).includes('@'))
  })
})
