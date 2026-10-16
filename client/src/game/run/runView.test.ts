import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RunState } from 'shared'
import { runView } from './runView.ts'

// Only what the view reads: the run's status and the visit, with the battle's own status.
const run = (status: RunState['status'], battle?: 'playing' | 'won' | 'lost') =>
  ({
    status,
    visit: battle ? { kind: 'battle', node: '0-0', game: { status: battle } } : null,
  }) as unknown as RunState

describe('the screen a run is on', () => {
  it('is the battle while one is being fought', () => {
    assert.equal(runView(run('playing', 'playing'), null, false), 'battle')
  })

  it('goes straight to the summary when a run is abandoned mid-battle', () => {
    assert.equal(runView(run('lost', 'playing'), null, false), 'summary')
  })

  it('keeps a lost battle on the board until the summary is asked for', () => {
    assert.equal(runView(run('lost', 'lost'), null, false), 'battle')
    assert.equal(runView(run('lost', 'lost'), null, true), 'summary')
  })

  it('is the summary for a run that ends off the board, and the map between nodes', () => {
    assert.equal(runView(run('lost'), null, false), 'summary')
    assert.equal(runView(run('playing'), null, false), 'map')
  })
})
