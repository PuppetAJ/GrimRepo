import { BOILERPLATE, card } from '../cards.ts'
import { HAND_LIMIT, LANES, type GameEvent, type GameState, type Side, type Slot, type Unit } from './types.ts'
import { drawUnit, makeUnit } from './units.ts'

function remove(row: Slot[], uid: number): number {
  const lane = row.findIndex((slot) => slot?.uid === uid)
  if (lane >= 0) row[lane] = null
  return lane
}

export function hotReload(state: GameState, side: Side, unit: Unit, lane: number, events: GameEvent[]): void {
  if (!unit.sigils.includes('hot_reload')) return
  if (side === 'player') {
    if (state.player.hand.length >= HAND_LIMIT) return
    const copy = once(unit.source === undefined ? makeUnit(state, unit.card) : drawUnit(state, unit.source))
    state.player.hand.push(copy)
    events.push({ type: 'reloaded', side, unit: copy, from: lane, lane: null })
  } else if (!state.opponent.back[lane]) {
    const copy = once(makeUnit(state, unit.card))
    state.opponent.back[lane] = copy
    events.push({ type: 'reloaded', side, unit: copy, from: lane, lane })
  }
}

const once = (copy: Unit): Unit => ({ ...copy, sigils: copy.sigils.filter((sigil) => sigil !== 'hot_reload') })

function failoverPlan(row: Slot[], attacked: number[]): Map<number, number> {
  const open = [...new Set(attacked)].filter((lane) => !row[lane]).sort((a, b) => a - b)
  const plan = new Map<number, number>()
  row.forEach((unit, from) => {
    if (!unit?.sigils.includes('failover')) return
    const to = open
      .filter((lane) => !plan.has(lane))
      .sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b)[0]
    if (to !== undefined) plan.set(to, from)
  })
  return plan
}

function failover(row: Slot[], lane: number, side: Side, plan: Map<number, number>, events: GameEvent[]): Unit | null {
  const from = plan.get(lane)
  if (from === undefined || !row[from]?.sigils.includes('failover') || row[lane]) return null
  plan.delete(lane)
  const unit = row[from] as Unit
  row[from] = null
  row[lane] = unit
  events.push({ type: 'moved', uid: unit.uid, side, from, to: lane })
  return unit
}

export function attackOf(state: GameState, side: Side, lane: number): number {
  const row = side === 'player' ? state.player.board : state.opponent.front
  const facing = side === 'player' ? state.opponent.front : state.player.board
  return attackIn(row, facing, lane)
}

export function attackIn(row: Slot[], facing: Slot[], lane: number): number {
  const unit = row[lane]
  if (!unit) return 0
  const leads = [lane - 1, lane + 1].filter((beside) => row[beside]?.sigils.includes('tech_lead')).length
  const opposite = facing[lane]
  const loss = opposite?.sigils.includes('packet_loss') ? 2 : 0
  const popup = opposite?.sigils.includes('popup') ? 1 : 0
  const scale = unit.sigils.includes('scale_out') ? kin(row, lane) : 0
  return Math.max(0, unit.attack + leads - loss + popup + scale)
}

export function kin(row: Slot[], lane: number): number {
  const type = card((row[lane] as Unit).card).type
  if (!type) return 0
  return row.filter((other, index) => index !== lane && other && card(other.card).type === type).length
}

export function reinforce(row: Slot[], lane: number, events: GameEvent[]): void {
  const unit = row[lane]
  if (!unit?.sigils.includes('redundancy')) return
  const gain = kin(row, lane)
  if (!gain) return
  unit.health += gain
  unit.maxHealth += gain
  events.push({ type: 'buffed', uid: unit.uid, attack: unit.attack, health: unit.health, sigils: [...unit.sigils] })
}

function loseIntegrity(state: GameState, unit: Unit, events: GameEvent[]): void {
  const integrity = state.integrity
  if (!integrity || unit.card === BOILERPLATE || integrity.left <= 0) return
  integrity.left -= 1
  events.push({ type: 'integrity', uid: unit.uid, change: -1, left: integrity.left })
}

function stayUp(unit: Unit, events: GameEvent[]): boolean {
  if (!unit.sigils.includes('uptime') || unit.stayedUp) return false
  unit.stayedUp = true
  unit.health = 1
  events.push({ type: 'stayedUp', uid: unit.uid })
  return true
}

export const integrityBroken = (state: GameState): boolean => state.integrity !== undefined && state.integrity.left <= 0

function damage(unit: Unit, amount: number, fatal: boolean, events: GameEvent[]): number {
  if (unit.sigils.includes('rollback') && !unit.rolledBack) {
    unit.rolledBack = true
    events.push({ type: 'shielded', uid: unit.uid })
    return unit.health
  }
  const left = unit.health - (fatal ? Math.max(amount, unit.health) : amount)
  unit.health = Math.max(0, left)
  events.push({ type: 'damaged', uid: unit.uid, amount, health: unit.health })
  return left <= 0 && stayUp(unit, events) ? unit.health : left
}

export const extraHit = (power: number): number => Math.max(1, Math.floor(power / 2))

export const forkHit = (power: number): number => Math.max(1, Math.floor((power * 3) / 4))

export function attack(state: GameState, side: Side, events: GameEvent[]): void {
  const attackers = side === 'player' ? state.player.board : state.opponent.front
  const defenders = side === 'player' ? state.opponent.front : state.player.board
  const toward = side === 'player' ? 1 : -1
  const within = (lanes: number[]) => lanes.filter((lane) => lane >= 0 && lane < LANES)

  const aims = attackers.flatMap((unit, lane) =>
    !unit || unit.sigils.includes('bypass')
      ? []
      : unit.sigils.includes('broadcast')
        ? within([lane - 1, lane, lane + 1])
        : unit.sigils.includes('fork')
          ? within([lane - 1, lane + 1])
          : [lane],
  )
  const covers = failoverPlan(defenders, aims)
  const covering = new Set<number>()

  const startingOrder = attackers.slice()
  for (const attacker of startingOrder) {
    if (!attacker) continue
    const lane = attackers.findIndex((slot) => slot?.uid === attacker.uid)
    if (lane < 0) continue
    const stillStanding = () => attackers[lane]?.uid === attacker.uid
    const lanes = attacker.sigils.includes('broadcast')
      ? within([lane - 1, lane, lane + 1])
      : attacker.sigils.includes('fork')
        ? within([lane - 1, lane + 1])
        : [lane]
    const strikes = attacker.sigils.includes('retry') ? 2 : 1
    const split = attacker.sigils.includes('fork') && lanes.length > 1
    const strikePower = (full: number, strike: number, aimed: number) =>
      strike > 0 ? extraHit(full) : split ? forkHit(full) : aimed === lane || lanes.length === 1 ? full : extraHit(full)
    let struck = false

    for (let strike = 0; strike < strikes; strike++) {
      for (const aimed of lanes) {
        if (!stillStanding()) break
        const full = attackOf(state, side, lane)
        if (full <= 0) break
        const power = strikePower(full, strike, aimed)
        if (power <= 0) continue
        struck = true
        const occupant = attacker.sigils.includes('bypass') ? null : defenders[aimed]
        const moved =
          attacker.sigils.includes('bypass') || occupant
            ? null
            : failover(defenders, aimed, side === 'player' ? 'opponent' : 'player', covers, events)
        if (moved) covering.add(moved.uid)
        const defender = occupant ?? moved
        events.push({ type: 'attacked', side, lane, target: defender ? aimed : 'face', aimed })

        if (!defender) {
          state.scale += toward * power
          events.push({
            type: 'hit',
            side: side === 'player' ? 'opponent' : 'player',
            amount: power,
            scale: state.scale,
          })
          continue
        }

        const taken = covering.has(defender.uid) ? Math.floor(power / 2) : power
        const left = damage(defender, taken, attacker.sigils.includes('fatal_error'), events)
        if (defender.sigils.includes('backtrace')) strikeBack(state, side, attacker, events)

        if (left <= 0) {
          remove(defenders, defender.uid)
          events.push({
            type: 'killed',
            uid: defender.uid,
            side: side === 'player' ? 'opponent' : 'player',
            lane: aimed,
            row: 'front',
          })
          if (side === 'opponent') loseIntegrity(state, defender, events)
          hotReload(state, side === 'player' ? 'opponent' : 'player', defender, aimed, events)
          if (attacker.sigils.includes('scope_creep') && stillStanding()) {
            attacker.attack += 1
            events.push({ type: 'buffed', uid: attacker.uid, attack: attacker.attack, health: attacker.health })
          }
          const behind = side === 'player' ? state.opponent.back[aimed] : null
          if (left < 0 && behind) overkill(state, aimed, behind, -left, events)
        }
      }
    }

    if (struck && attacker.sigils.includes('deprecated') && stillStanding()) {
      remove(attackers, attacker.uid)
      events.push({ type: 'killed', uid: attacker.uid, side, lane, row: 'front' })
      hotReload(state, side, attacker, lane, events)
      const left = makeUnit(state, BOILERPLATE)
      attackers[lane] = left
      events.push({ type: 'leftBehind', side, lane, unit: left })
    }
    if (struck && attacker.sigils.includes('load_balancer') && stillStanding()) {
      const ahead = lane + (attacker.heading ?? 1)
      const back = lane - (attacker.heading ?? 1)
      const free = (to: number) => to >= 0 && to < LANES && !attackers[to]
      const to = free(ahead) ? ahead : free(back) ? back : null
      if (to !== null) {
        attackers[lane] = null
        attackers[to] = attacker
        attacker.heading = to > lane ? 1 : -1
        events.push({ type: 'moved', uid: attacker.uid, side, from: lane, to, heading: attacker.heading })
      }
    }
  }
}

export const BACKTRACE_DAMAGE = 2

function strikeBack(state: GameState, side: Side, attacker: Unit, events: GameEvent[]): void {
  if (attacker.sigils.includes('rollback') && !attacker.rolledBack) {
    attacker.rolledBack = true
    events.push({ type: 'shielded', uid: attacker.uid })
    return
  }
  attacker.health = Math.max(0, attacker.health - BACKTRACE_DAMAGE)
  events.push({ type: 'struckBack', uid: attacker.uid, amount: BACKTRACE_DAMAGE })
  if (attacker.health > 0 || stayUp(attacker, events)) return
  const row = side === 'player' ? state.player.board : state.opponent.front
  const lane = remove(row, attacker.uid)
  events.push({ type: 'killed', uid: attacker.uid, side, lane, row: 'front' })
  if (side === 'player') loseIntegrity(state, attacker, events)
  hotReload(state, side, attacker, lane, events)
}

function overkill(state: GameState, lane: number, unit: Unit, amount: number, events: GameEvent[]): void {
  events.push({ type: 'overkill', lane, amount })
  if (damage(unit, amount, false, events) > 0) return
  state.opponent.back[lane] = null
  events.push({ type: 'killed', uid: unit.uid, side: 'opponent', lane, row: 'back' })
  hotReload(state, 'opponent', unit, lane, events)
}
